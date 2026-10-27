import type JSZip from 'jszip';
import type { Graph } from '../engine';
import {
  compile,
  defaultBackendRegistry,
  generatePythonProgram,
  lower,
  migrateAllScreens,
  normalizeGraph,
  validateAllScreensForPlatform,
  type ScreenUI,
} from '../compiler';
import { models } from './models';

/**
 * Gera a interface Tkinter desacoplada da lógica e conectada a program.py.
 * Suporta árvores declarativas de UI (ScreenUI / ComponentTree), bindings, repetidores
 * e estados de tela, além de migrar telas legadas sem depender de coordenadas físicas.
 */
export function generateTkinterApp(g: Graph): string {
  const screensRecord: Record<string, ScreenUI> = migrateAllScreens(g);
  const screenIds = Object.keys(screensRecord);
  const startScreen = screenIds.length > 0 ? screenIds[0] : '';

  return `"""
FlowForge Desktop Application (Tkinter)
Interface gráfica declarativa conectada ao programa compilado (program.py)
Suporta árvores de componentes ScreenUI, layout flex/grid, bindings e repetidores.
"""
from __future__ import annotations
import asyncio
import json
import tkinter as tk
from tkinter import ttk
from typing import Any, Dict, List, Optional
from program import create_program

SCREENS_DATA: Dict[str, Any] = ${JSON.stringify(screensRecord, null, 4)}
START_SCREEN = ${JSON.stringify(startScreen)}
TITLE = ${JSON.stringify(g.name || 'FlowForge App')}

def resolve_path(scope: Dict[str, Any], path: str) -> Any:
    if not path or not isinstance(path, str):
        return None
    parts = path.strip().split(".")
    if not parts:
        return None
    first = parts[0]
    curr = None

    if first in scope:
        curr = scope[first]
    elif scope.get("item") and isinstance(scope["item"], dict) and first in scope["item"]:
        curr = scope["item"][first]
    elif first in scope.get("store", {}):
        curr = scope.get("store", {})[first]
    elif first in scope.get("inputs", {}):
        curr = scope.get("inputs", {})[first]
    elif first in scope.get("variables", {}):
        curr = scope.get("variables", {})[first]
    else:
        return None

    for p in parts[1:]:
        if isinstance(curr, dict):
            curr = curr.get(p)
        else:
            return None
    return curr

def evaluate_binding(binding: Any, scope: Dict[str, Any]) -> Any:
    if binding is None:
        return None
    if isinstance(binding, (str, int, float, bool)):
        return binding
    if not isinstance(binding, dict):
        return None

    kind = binding.get("kind")
    if kind == "literal":
        return binding.get("value")
    if kind == "path":
        return resolve_path(scope, binding.get("path", ""))
    if kind == "binary":
        left = evaluate_binding(binding.get("left"), scope)
        right = evaluate_binding(binding.get("right"), scope) if "right" in binding else None
        op = binding.get("op")
        if op == "truthy":
            return bool(left)
        if op == "eq":
            return left == right
        if op == "neq":
            return left != right
        try:
            nl = float(left) if left is not None else 0.0
            nr = float(right) if right is not None else 0.0
            if op == "gt":
                return nl > nr
            if op == "gte":
                return nl >= nr
            if op == "lt":
                return nl < nr
            if op == "lte":
                return nl <= nr
        except Exception:
            return False
    return None

def is_visible(comp: Dict[str, Any], scope: Dict[str, Any]) -> bool:
    if not comp.get("visible"):
        return True
    return bool(evaluate_binding(comp["visible"], scope))

class FlowForgeApp:
    def __init__(self, root: tk.Tk):
        self.root = root
        self.root.title(TITLE)
        self.root.geometry("480x680")
        self.root.configure(bg="#f8fafc")

        self.program = create_program()
        self.current_screen = START_SCREEN or (list(SCREENS_DATA.keys())[0] if SCREENS_DATA else None)
        self.entries: Dict[str, tk.Entry] = {}
        self.text_entries: Dict[str, tk.Text] = {}
        self.select_entries: Dict[str, ttk.Combobox] = {}
        self.check_vars: Dict[str, tk.BooleanVar] = {}
        self.radio_vars: Dict[str, tk.StringVar] = {}

        self.main_container = tk.Frame(root, bg="#ffffff", padx=24, pady=24)
        self.main_container.pack(fill="both", expand=True, padx=16, pady=16)

        self.notification_label = tk.Label(
            self.main_container,
            text="",
            bg="#ffffff",
            fg="#64748b",
            font=("Segoe UI", 10),
            wraplength=400,
            justify="center"
        )
        self.notification_label.pack(fill="x", pady=(0, 12))

        self.screen_frame = tk.Frame(self.main_container, bg="#ffffff")
        self.screen_frame.pack(fill="both", expand=True)

        if self.current_screen:
            self.render_screen(self.current_screen)

    def collect_inputs(self) -> Dict[str, Any]:
        inputs: Dict[str, Any] = {}
        for k, w in self.entries.items():
            inputs[k] = w.get()
        for k, w in self.text_entries.items():
            inputs[k] = w.get("1.0", "end-1c")
        for k, w in self.select_entries.items():
            inputs[k] = w.get()
        for k, var in self.check_vars.items():
            inputs[k] = "true" if var.get() else "false"
        for k, var in self.radio_vars.items():
            inputs[k] = var.get()
        return inputs

    def render_screen(self, screen_id: str):
        self.current_screen = screen_id
        for child in self.screen_frame.winfo_children():
            child.destroy()
        self.entries.clear()
        self.text_entries.clear()
        self.select_entries.clear()
        self.check_vars.clear()
        self.radio_vars.clear()

        screen_data = SCREENS_DATA.get(screen_id)
        if not screen_data:
            return

        scope = {
            "store": self.program.get_state() if hasattr(self.program, "get_state") else {},
            "inputs": self.collect_inputs(),
            "variables": {}
        }

        states = screen_data.get("states") or {}
        state_binding = screen_data.get("stateBinding") or {}
        if states.get("loading") and state_binding.get("loading") and evaluate_binding(state_binding["loading"], scope):
            self.render_component(states["loading"], self.screen_frame, scope)
            return
        if states.get("error") and state_binding.get("error") and evaluate_binding(state_binding["error"], scope):
            self.render_component(states["error"], self.screen_frame, scope)
            return
        if states.get("empty") and state_binding.get("empty") and evaluate_binding(state_binding["empty"], scope):
            self.render_component(states["empty"], self.screen_frame, scope)
            return

        title_text = screen_data.get("title") or "Tela"
        title_lbl = tk.Label(
            self.screen_frame,
            text=title_text,
            font=("Segoe UI", 18, "bold"),
            bg="#ffffff",
            fg="#0f172a"
        )
        title_lbl.pack(anchor="w", pady=(0, 16))

        root_comp = screen_data.get("root")
        if root_comp:
            self.render_component(root_comp, self.screen_frame, scope)

    def render_component(self, comp: Dict[str, Any], parent: tk.Widget, scope: Dict[str, Any]):
        if not is_visible(comp, scope):
            return

        ctype = comp.get("type")

        if ctype == "container":
            layout = comp.get("layout") or {}
            ltype = layout.get("type", "flex")
            frame = tk.Frame(parent, bg="#ffffff")

            if ltype == "grid":
                frame.pack(fill="both", expand=True, pady=4)
                cols = layout.get("columns", 1)
                try:
                    num_cols = int(cols)
                except Exception:
                    num_cols = 1
                for idx, child in enumerate(comp.get("children", [])):
                    r = idx // num_cols
                    c = idx % num_cols
                    sub_f = tk.Frame(frame, bg="#ffffff")
                    sub_f.grid(row=r, column=c, padx=layout.get("gap", 6), pady=layout.get("gap", 6), sticky="nsew")
                    self.render_component(child, sub_f, scope)
            else:
                dir_ = layout.get("direction", "column")
                frame.pack(fill="x", pady=layout.get("gap", 6))
                for child in comp.get("children", []):
                    sub_f = tk.Frame(frame, bg="#ffffff")
                    if dir_ == "row":
                        sub_f.pack(side="left", padx=layout.get("gap", 6), fill="y")
                    else:
                        sub_f.pack(fill="x", pady=layout.get("gap", 4))
                    self.render_component(child, sub_f, scope)

        elif ctype == "text":
            raw_content = comp.get("content", "")
            text_val = str(evaluate_binding(raw_content, scope) if isinstance(raw_content, dict) else raw_content)
            style = comp.get("style", "body")
            font_spec = (
                ("Segoe UI", 16, "bold") if style == "title" else
                ("Segoe UI", 13, "bold") if style == "heading" else
                ("Segoe UI", 9) if style == "caption" else
                ("Segoe UI", 11)
            )
            fg_color = comp.get("color") or ("#0f172a" if style in ("title", "heading") else "#64748b" if style == "caption" else "#334155")
            lbl = tk.Label(parent, text=text_val, font=font_spec, bg="#ffffff", fg=fg_color, wraplength=400, justify=comp.get("align", "left"))
            lbl.pack(anchor="w", pady=3)

        elif ctype == "image":
            src = str(evaluate_binding(comp.get("src"), scope) if isinstance(comp.get("src"), dict) else comp.get("src", ""))
            alt = comp.get("alt", "Imagem")
            loaded = False
            if src and not src.startswith("http://") and not src.startswith("https://"):
                try:
                    photo = tk.PhotoImage(file=src)
                    lbl = tk.Label(parent, image=photo, bg="#ffffff")
                    lbl.image = photo
                    lbl.pack(fill="x", pady=6)
                    loaded = True
                except Exception:
                    loaded = False
            if not loaded:
                placeholder = tk.Label(parent, text=f"[Imagem: {alt}]", bg="#f1f5f9", fg="#64748b", height=3, relief="groove")
                placeholder.pack(fill="x", pady=6)

        elif ctype == "input":
            key = comp.get("bindingPath") or comp.get("id")
            lbl = tk.Label(parent, text=comp.get("label", "Campo"), font=("Segoe UI", 10, "bold"), bg="#ffffff", fg="#334155")
            lbl.pack(anchor="w", pady=(6, 2))
            is_password = comp.get("inputType") == "password"
            entry = tk.Entry(parent, show="*" if is_password else "", font=("Segoe UI", 11), relief="solid", bd=1)
            init_val = comp.get("defaultValue", "")
            if init_val:
                entry.insert(0, str(init_val))
            entry.pack(fill="x", pady=(0, 6), ipady=3)
            self.entries[key] = entry

        elif ctype == "textarea":
            key = comp.get("bindingPath") or comp.get("id")
            lbl = tk.Label(parent, text=comp.get("label", "Área de texto"), font=("Segoe UI", 10, "bold"), bg="#ffffff", fg="#334155")
            lbl.pack(anchor="w", pady=(6, 2))
            txt = tk.Text(parent, height=comp.get("rows", 3), font=("Segoe UI", 10), relief="solid", bd=1)
            init_val = comp.get("defaultValue", "")
            if init_val:
                txt.insert("1.0", str(init_val))
            txt.pack(fill="x", pady=(0, 6))
            self.text_entries[key] = txt

        elif ctype == "select":
            key = comp.get("bindingPath") or comp.get("id")
            lbl = tk.Label(parent, text=comp.get("label", "Seleção"), font=("Segoe UI", 10, "bold"), bg="#ffffff", fg="#334155")
            lbl.pack(anchor="w", pady=(6, 2))
            options = comp.get("options", [])
            labels = [o.get("label", "") for o in options]
            combo = ttk.Combobox(parent, values=labels, state="readonly", font=("Segoe UI", 10))
            if labels:
                combo.current(0)
            combo.pack(fill="x", pady=(0, 6))
            self.select_entries[key] = combo

        elif ctype == "checkbox":
            key = comp.get("bindingPath") or comp.get("id")
            var = tk.BooleanVar(value=bool(comp.get("defaultChecked", False)))
            chk = tk.Checkbutton(parent, text=comp.get("label", ""), variable=var, bg="#ffffff", font=("Segoe UI", 10))
            chk.pack(anchor="w", pady=4)
            self.check_vars[key] = var

        elif ctype == "radio":
            key = comp.get("bindingPath") or comp.get("id")
            options = comp.get("options", [])
            default_val = comp.get("defaultValue", options[0].get("value", "") if options else "")
            var = tk.StringVar(value=default_val)
            lbl = tk.Label(parent, text=comp.get("label", ""), font=("Segoe UI", 10, "bold"), bg="#ffffff", fg="#334155")
            lbl.pack(anchor="w", pady=(6, 2))
            for opt in options:
                rb = tk.Radiobutton(parent, text=opt.get("label", ""), value=opt.get("value", ""), variable=var, bg="#ffffff", font=("Segoe UI", 10))
                rb.pack(anchor="w", padx=8, pady=2)
            self.radio_vars[key] = var

        elif ctype == "button":
            action_id = comp.get("actionEvent") or comp.get("id")
            btn_text = comp.get("label", "Executar")
            btn = tk.Button(
                parent,
                text=btn_text,
                font=("Segoe UI", 10, "bold"),
                bg="#4f46e5",
                fg="#ffffff",
                relief="flat",
                cursor="hand2",
                command=lambda aid=action_id: self.handle_button_click(aid)
            )
            is_disabled = bool(evaluate_binding(comp.get("disabled"), scope)) if comp.get("disabled") else False
            if is_disabled:
                btn.config(state="disabled")
            btn.pack(fill="x", pady=6, ipady=5)

        elif ctype == "list":
            items = resolve_path(scope, comp.get("itemsPath", ""))
            if not isinstance(items, list) or len(items) == 0:
                if comp.get("emptyState"):
                    self.render_component(comp["emptyState"], parent, scope)
                else:
                    lbl = tk.Label(parent, text="Nenhum item disponível.", font=("Segoe UI", 9), fg="#94a3b8", bg="#ffffff")
                    lbl.pack(anchor="w", pady=4)
            else:
                item_var = comp.get("itemVarName", "item")
                list_f = tk.Frame(parent, bg="#ffffff")
                list_f.pack(fill="x", pady=4)
                for idx, itm in enumerate(items):
                    row_f = tk.Frame(list_f, bg="#ffffff", relief="groove", bd=1, padx=6, pady=4)
                    row_f.pack(fill="x", pady=3)
                    sub_scope = {**scope, "item": itm, item_var: itm, "index": idx}
                    self.render_component(comp.get("template", {}), row_f, sub_scope)

        elif ctype == "modal":
            is_open = bool(evaluate_binding(comp.get("openBinding"), scope)) if comp.get("openBinding") else True
            if is_open:
                top = tk.Toplevel(self.root)
                top.title(comp.get("title", "Modal"))
                top.geometry("380x300")
                top.configure(bg="#ffffff", padx=16, pady=16)
                if comp.get("title"):
                    tk.Label(top, text=comp["title"], font=("Segoe UI", 12, "bold"), bg="#ffffff").pack(anchor="w", pady=(0, 8))
                for child in comp.get("children", []):
                    self.render_component(child, top, scope)
                if comp.get("closeEvent"):
                    tk.Button(
                        top,
                        text="Fechar",
                        command=lambda cid=comp["closeEvent"]: [top.destroy(), self.handle_button_click(cid)]
                    ).pack(pady=8)

    def handle_button_click(self, button_id: str):
        inputs = self.collect_inputs()
        try:
            res = asyncio.run(self.program.dispatch(button_id, inputs))
            messages = res.get("messages", [])
            success = res.get("success", False)

            if messages:
                msg_text = " | ".join(str(m) for m in messages)
                fg_color = "#16a34a" if success else "#dc2626"
                self.notification_label.config(text=msg_text, fg=fg_color)
            else:
                self.notification_label.config(text="")

            next_screen = res.get("screen")
            if next_screen and next_screen != self.current_screen and next_screen in SCREENS_DATA:
                self.render_screen(next_screen)
            else:
                self.render_screen(self.current_screen)

        except Exception as exc:
            self.notification_label.config(text=f"Erro de execução: {exc}", fg="#dc2626")

def main():
    root = tk.Tk()
    app = FlowForgeApp(root)
    root.mainloop()

if __name__ == "__main__":
    main()
`;
}

/**
 * Adiciona ao ZIP os artefatos do projeto Python compilado a partir da ProgramIR.
 */
export function addPythonProject(zip: JSZip, g: Graph) {
  if (
    g.nodes.some(
      (node) =>
        node.data.kind === 'httpConnection' ||
        (node.data.kind === 'api' && node.data.config.mode === 'real') ||
        node.data.kind === 'postgresConnection' ||
        (node.data.kind === 'database' && node.data.config.mode === 'real'),
    )
  )
    throw new Error(
      'Integrações reais (HTTP ou PostgreSQL) exigem exportação TypeScript + React com backend nesta fase.',
    );
  const comp = compile(g);
  let programCode: string;
  const pyBackend = defaultBackendRegistry.get('python');
  if (comp.ok) {
    programCode = pyBackend
      ? pyBackend.emit(comp.value).artifacts[0]?.content || generatePythonProgram(comp.value)
      : generatePythonProgram(comp.value);
  } else {
    const normalized = normalizeGraph(g);
    const ir = lower(normalized);
    programCode = pyBackend
      ? pyBackend.emit(ir).artifacts[0]?.content || generatePythonProgram(ir)
      : generatePythonProgram(ir);
  }

  const warningSections: string[] = [];

  const incompatible = g.nodes.find(
    (n) =>
      n.data.kind === 'function' &&
      n.data.config.code &&
      n.data.config.code.trim() !== 'return value;',
  );
  if (incompatible) {
    warningSections.push(
      `[INCOMPATIBLE_PYTHON_EXPORT] O bloco "${incompatible.data.label}" (${incompatible.id}) contém código textual JavaScript e não é portável para Python.\nSubstitua o bloco textual por blocos visuais da Fase 7 (math, text, compare, boolean, object, array).`,
    );
  }

  const screensRecord = migrateAllScreens(g);
  const uiDiagnostics = validateAllScreensForPlatform(screensRecord, 'tkinter');
  if (uiDiagnostics.length > 0) {
    const lines = uiDiagnostics.map((d) => `[${d.code}] Tela "${d.screenId}" - ${d.message}`);
    warningSections.push(`[TKINTER_PLATFORM_LIMITATIONS]\n${lines.join('\n')}`);
  }

  if (warningSections.length > 0) {
    zip.file('DIAGNOSTIC_WARNING.txt', warningSections.join('\n\n'));
  }

  zip.file('program.py', programCode);
  zip.file('app.py', generateTkinterApp(g));
  zip.file('models.py', models(g, 'python'));
}
