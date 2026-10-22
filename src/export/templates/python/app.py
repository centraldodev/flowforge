import json
import re
import math
from pathlib import Path
import tkinter as tk

g = json.loads(Path(__file__).with_name('graph.json').read_text(encoding='utf-8'))
nodes = {n['id']: n for n in g['nodes']}
store = {'__users': [{'email': 'demo@exemplo.com', 'password': '123456'}]}
values = {}

VALUE_KINDS = ['input', 'textarea', 'select', 'checkbox', 'constant']


def input_value(source):
    c = source['data']['config']; kind = source['data']['kind']
    value = values.get(source['id'], c.get('value', ''))
    if kind == 'checkbox': return value == 'true'
    if kind == 'constant':
        t = c['valueType']
        return float(value) if t == 'number' else value == 'true' if t == 'boolean' else json.loads(value) if t == 'json' else value
    return value


def execute(start, initial_screen=None):
    outputs, trace, screen = {}, [], None

    def read(node, port, fallback=''):
        edges = [e for e in g['edges'] if e['target'] == node and e.get('targetHandle') == port]
        edge = next((e for e in edges if e['source'] in outputs), edges[0] if edges else None)
        if not edge: return fallback
        source = nodes[edge['source']]
        if source['data']['kind'] in VALUE_KINDS: return input_value(source)
        return outputs.get(source['id'], fallback)

    origin_id = initial_screen or nodes[start]['data']['config'].get('screenId')
    origin = nodes.get(origin_id, {})
    routes = json.loads(origin.get('data', {}).get('config', {}).get('routes', '[]'))
    current = start
    for step in range(100):
        if not current: return screen, trace
        n = nodes[current]; d = n['data']; c = d['config']; kind = d['kind']
        out, branch, message = True, 'next', 'Executado'
        if kind == 'screen': screen, message = current, 'Tela aberta'
        elif kind in VALUE_KINDS: out = input_value(n)
        elif kind == 'text': out = c['text']
        elif kind == 'divider': out = None
        elif kind == 'variable':
            key = 'variable:' + c['key']
            if c['operation'] == 'set': store[key] = [read(current, 'value', c['value'])]
            out = store.get(key, [c['value']])[0]; message = 'Variável: ' + c['key']
        elif kind == 'validation':
            value = str(read(current, 'value')); rule = c['rule']
            if rule == 'email': out = bool(re.fullmatch(r'[^\s@]+@[^\s@]+[.][^\s@]+', value))
            elif rule == 'minLength': out = len(value) >= float(c['minimum'])
            elif rule == 'number':
                try: out = bool(value.strip()) and math.isfinite(float(value))
                except ValueError: out = False
            else: out = bool(value.strip())
            branch = 'true' if out else 'false'; message = 'Validação aprovada' if out else 'Validação reprovada'
        elif kind == 'transform':
            value = str(read(current, 'value', c['value'])); op = c['operation']
            out = value.upper() if op == 'upper' else value.lower() if op == 'lower' else value + c['suffix'] if op == 'concat' else value.strip()
            message = 'Texto: ' + out
        elif kind == 'notify': out = read(current, 'value', c['message']); message = str(out)
        elif kind == 'logout': store.pop('__session', None); message = 'Sessão simulada encerrada'
        elif kind == 'auth':
            email, password = str(read(current, 'email')), str(read(current, 'password'))
            if c['provider'] != 'email': message = c['provider'] + ': autenticação simulada'
            elif c['mode'] == 'register':
                out = '@' in email and len(password) >= 6 and not any(u['email'] == email for u in store['__users'])
                if out: store['__users'].append({'email': email, 'password': password})
                message = 'Conta simulada criada' if out else 'Use e-mail novo e senha com 6 caracteres'
            else:
                out = any(u['email'] == email and u['password'] == password for u in store['__users'])
                message = 'Acesso simulado autorizado' if out else 'E-mail ou senha inválidos'
        elif kind == 'condition':
            value = read(current, 'value')
            out = str(value).lower() == c['compare'].lower() if c['operator'] == 'equals' else float(value) > float(c['compare']) if c['operator'] == 'gt' else bool(value)
            branch = 'true' if out else 'false'; message = 'Caminho ' + branch
        elif kind == 'math':
            a, b = float(read(current, 'a', c['a'])), float(read(current, 'b', c['b']))
            op = c['operation']
            out = a-b if op == 'subtract' else a*b if op == 'multiply' else a/b if op == 'divide' else a+b
            message = 'Resultado: ' + str(out)
        elif kind == 'api': out = json.loads(c['mock']); message = c['method'] + ' ' + c['url'] + ' (simulado)'
        elif kind == 'database':
            rows = store.setdefault(c['table'], json.loads(c['mock']))
            if not isinstance(rows, list): raise ValueError('Banco exige array JSON')
            if c['operation'] == 'insert': rows.append(read(current, 'value', {}))
            out = list(rows); message = str(len(rows)) + ' registro(s) em memória'
        elif kind == 'reset': out = '@' in str(read(current, 'email')); message = 'Recuperação simulada por ' + c['channel'] if out else 'Informe um e-mail'
        elif kind == 'navigate': screen = c['target']; message = 'Navegando'
        elif kind == 'class': out = {f.strip(): None for f in c['fields'].split(',')}
        if kind == 'auth':
            if out: store['__session'] = [{'provider': c['provider'], 'email': read(current, 'email')}]
            else: store.pop('__session', None)
        outputs[current] = out; trace.append(d['label'] + ': ' + message)
        route = next((r for r in routes if r['trigger'] == current and (r['when'] == 'always' or (out is True if r['when'] == 'true' else out is False))), None)
        if route:
            target = nodes.get(route['target'])
            if not target or target['data']['kind'] != 'screen': raise ValueError('Tela de destino não existe')
            trace.append('Transição: ' + d['label'] + ' → ' + target['data']['label'])
            return route['target'], trace
        current = next((e['target'] for e in g['edges'] if e['source'] == current and e.get('sourceHandle') == branch), None)
    if current: raise ValueError('Limite de 100 passos: possível ciclo')
    return screen, trace


root = tk.Tk(); root.title(g['name']); root.geometry('460x680')
frame = tk.Frame(root, padx=30, pady=30); frame.pack(fill='both', expand=True)


def show(screen, trace=None):
    for child in frame.winfo_children(): child.destroy()
    tk.Label(frame, text='PROTÓTIPO · Integrações simuladas').pack(pady=8)
    page = nodes.get(screen, {})
    tk.Label(frame, text=page.get('data', {}).get('config', {}).get('title', 'Aplicativo'), font=('', 22)).pack(pady=20)
    entries = {}

    def click(start):
        for key, getter in entries.items(): values[key] = getter()
        try:
            target, log = execute(start, screen); show(target or screen, log)
        except Exception as error: show(screen, [str(error)])

    for n in g['nodes']:
        d = n['data']; c = d['config']
        if c.get('screenId') != screen: continue
        if d['kind'] == 'input':
            tk.Label(frame, text=d['label']).pack(anchor='w')
            entry = tk.Entry(frame, show='*' if c['field'] == 'password' else '')
            entry.insert(0, values.get(n['id'], c.get('value', ''))); entry.pack(fill='x', pady=8); entries[n['id']] = entry.get
        elif d['kind'] == 'text': tk.Label(frame, text=c['text'], wraplength=380, justify='left', font=('', 18 if c['style'] == 'title' else 10 if c['style'] == 'caption' else 12)).pack(anchor='w', pady=8)
        elif d['kind'] == 'divider': tk.Frame(frame, height=1, bg='#cccccc').pack(fill='x', pady=12)
        elif d['kind'] == 'textarea':
            tk.Label(frame, text=d['label']).pack(anchor='w')
            entry = tk.Text(frame, height=3); entry.insert('1.0', values.get(n['id'], c.get('value', ''))); entry.pack(fill='x', pady=8)
            entries[n['id']] = lambda widget=entry: widget.get('1.0', 'end-1c')
        elif d['kind'] == 'select':
            tk.Label(frame, text=d['label']).pack(anchor='w')
            var = tk.StringVar(value=values.get(n['id'], c.get('value', '')))
            tk.OptionMenu(frame, var, *[v.strip() for v in c['options'].split(',')]).pack(fill='x', pady=8); entries[n['id']] = var.get
        elif d['kind'] == 'checkbox':
            var = tk.BooleanVar(value=values.get(n['id'], c.get('value', 'false')) == 'true')
            tk.Checkbutton(frame, text=d['label'], variable=var).pack(anchor='w', pady=8)
            entries[n['id']] = lambda variable=var: 'true' if variable.get() else 'false'
        elif d['kind'] == 'button': tk.Button(frame, text=d['label'], command=lambda key=n['id']: click(key)).pack(fill='x', pady=8)
    if trace: tk.Label(frame, text='\n'.join(trace), wraplength=380, justify='left').pack(pady=16)


show(next((n['id'] for n in g['nodes'] if n['data']['kind'] == 'screen'), None))
root.mainloop()
