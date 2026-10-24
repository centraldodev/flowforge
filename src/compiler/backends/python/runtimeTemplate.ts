/**
 * Código de runtime leve embutido no programa gerado pelo backend Python.
 * Fornece adaptadores mock, validações builtin e contexto de execução com paridade total ao JavaScript.
 */
export const PYTHON_EMBEDDED_RUNTIME = `
DEMO_USER = {"email": "demo@exemplo.com", "password": "123456", "nome": "Usuário Demo"}

class MockAuthAdapter:
    async def execute(self, action: str, payload: dict, context: Any) -> dict:
        email = str(payload.get("email") or "")
        password = str(payload.get("password") or "")

        if not email and isinstance(context.inputs, dict):
            for k, v in context.inputs.items():
                if "email" in k.lower():
                    email = str(v or "")
                    break

        if not password and isinstance(context.inputs, dict):
            for k, v in context.inputs.items():
                if "senha" in k.lower() or "password" in k.lower():
                    password = str(v or "")
                    break

        db_table = "usuarios"
        db_rows = context.store.setdefault(
            db_table,
            [{"id": 1, **DEMO_USER, "senha": DEMO_USER["password"], "provider": "email"}]
        )

        if action == "google":
            google_email = "google.teste@gmail.com"
            mock_token = "ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE"
            google_user = {
                "id": 2,
                "nome": "Google Teste",
                "email": google_email,
                "provider": "google",
                "token": mock_token
            }
            existing = next((u for u in db_rows if u.get("email") == google_email), None)
            if existing:
                existing["token"] = mock_token
                existing["provider"] = "google"
            else:
                db_rows.append(google_user)
            context.store["__session"] = [google_user]
            return google_user

        if action == "register":
            exists = any(u.get("email") == email for u in db_rows)
            if exists:
                context.store.pop("__session", None)
                raise RuntimeError("E-mail já cadastrado no banco de dados")
            if "@" not in email or len(password) < 6:
                context.store.pop("__session", None)
                raise RuntimeError("Use e-mail válido e senha com 6 caracteres")
            new_user = {
                "id": len(db_rows) + 1,
                "nome": email.split("@")[0],
                "email": email,
                "senha": password,
                "provider": "email"
            }
            db_rows.append(new_user)
            context.store["__session"] = [new_user]
            return new_user

        user_in_db = next(
            (u for u in db_rows if u.get("email") == email and (u.get("senha") == password or u.get("password") == password)),
            None
        )
        if user_in_db:
            context.store["__session"] = [user_in_db]
            return user_in_db

        if email == DEMO_USER["email"] and password == DEMO_USER["password"]:
            context.store["__session"] = [DEMO_USER]
            return DEMO_USER

        context.store.pop("__session", None)
        raise RuntimeError("E-mail ou senha incorretos")

class MockDatabaseAdapter:
    async def execute(self, action: str, payload: dict, context: Any) -> Any:
        table = str(payload.get("table") or "itens")
        rows = context.store.setdefault(table, [])

        if len(rows) == 0 and payload.get("mock"):
            mock_val = payload.get("mock")
            if isinstance(mock_val, str) and mock_val.strip():
                try:
                    parsed = json.loads(mock_val)
                    if isinstance(parsed, list):
                        rows.extend(parsed)
                except Exception:
                    pass
            elif isinstance(mock_val, list):
                rows.extend(mock_val)

        op = str(payload.get("operation") or action or "query").lower()

        # 1. INSERT
        if op == "insert":
            raw_data = payload.get("data") if payload.get("data") is not None else payload.get("user") if payload.get("user") is not None else payload.get("value")
            if isinstance(raw_data, str) and raw_data.strip().startswith("{"):
                try:
                    raw_data = json.loads(raw_data)
                except Exception:
                    pass
            record = dict(raw_data) if isinstance(raw_data, dict) else {"value": raw_data}
            if record.get("id") is None or record.get("id") == "":
                max_id = 0
                for r in rows:
                    if isinstance(r, dict) and "id" in r:
                        try:
                            nid = int(r["id"])
                            if nid > max_id:
                                max_id = nid
                        except Exception:
                            pass
                record["id"] = max_id + 1

            rows.append(record)
            context.variables["value"] = record
            context.outputs["value"] = record
            return record

        # 2. GET
        if op == "get":
            target_id = payload.get("id") if payload.get("id") not in (None, "") else (payload.get("data", {}).get("id") if isinstance(payload.get("data"), dict) else None)
            found = None
            if target_id is not None:
                for r in rows:
                    if isinstance(r, dict) and (r.get("id") == target_id or str(r.get("id")) == str(target_id)):
                        found = r
                        break
            elif isinstance(payload.get("filter"), dict):
                f_obj = payload["filter"]
                for r in rows:
                    if isinstance(r, dict) and all(r.get(k) == v or str(r.get(k)) == str(v) for k, v in f_obj.items()):
                        found = r
                        break
            if not found:
                raise RuntimeError(f"Registro com ID '{target_id}' não encontrado na tabela '{table}'.")
            context.variables["value"] = found
            context.outputs["value"] = found
            return found

        # 3. UPDATE
        if op == "update":
            raw_updates = payload.get("data") if payload.get("data") is not None else payload.get("value")
            if isinstance(raw_updates, str) and raw_updates.strip().startswith("{"):
                try:
                    raw_updates = json.loads(raw_updates)
                except Exception:
                    pass
            updates = dict(raw_updates) if isinstance(raw_updates, dict) else {}
            target_id = payload.get("id") if payload.get("id") not in (None, "") else updates.get("id")

            idx = -1
            for i, r in enumerate(rows):
                if isinstance(r, dict) and (r.get("id") == target_id or str(r.get("id")) == str(target_id)):
                    idx = i
                    break
            if idx == -1:
                raise RuntimeError(f"Registro com ID '{target_id}' não encontrado para atualização na tabela '{table}'.")

            orig_id = rows[idx].get("id")
            updated = {**rows[idx], **updates}
            if orig_id is not None:
                updated["id"] = orig_id
            rows[idx] = updated

            context.variables["value"] = updated
            context.outputs["value"] = updated
            return updated

        # 4. DELETE
        if op == "delete":
            target_id = payload.get("id") if payload.get("id") not in (None, "") else (payload.get("data", {}).get("id") if isinstance(payload.get("data"), dict) else None)
            idx = -1
            for i, r in enumerate(rows):
                if isinstance(r, dict) and (r.get("id") == target_id or str(r.get("id")) == str(target_id)):
                    idx = i
                    break
            if idx == -1:
                raise RuntimeError(f"Registro com ID '{target_id}' não encontrado para exclusão na tabela '{table}'.")

            deleted = rows.pop(idx)
            res = {"success": True, "id": target_id, "deletedCount": 1, "item": deleted}
            context.variables["value"] = res
            context.outputs["value"] = res
            context.variables["deletedCount"] = 1
            context.outputs["deletedCount"] = 1
            return res

        # 5. QUERY
        filtered = list(rows)
        filt = payload.get("filter")
        if filt:
            if isinstance(filt, list):
                for f in filt:
                    if isinstance(f, dict):
                        fld = f.get("field")
                        op_c = f.get("op", "eq")
                        val = f.get("value")
                        new_filt = []
                        for r in filtered:
                            if not isinstance(r, dict):
                                continue
                            r_val = r.get(fld)
                            if op_c == "eq" and (r_val == val or str(r_val) == str(val)):
                                new_filt.append(r)
                            elif op_c == "neq" and (r_val != val and str(r_val) != str(val)):
                                new_filt.append(r)
                            elif op_c == "gt":
                                try:
                                    if float(r_val) > float(val):
                                        new_filt.append(r)
                                except Exception:
                                    pass
                            elif op_c == "gte":
                                try:
                                    if float(r_val) >= float(val):
                                        new_filt.append(r)
                                except Exception:
                                    pass
                            elif op_c == "lt":
                                try:
                                    if float(r_val) < float(val):
                                        new_filt.append(r)
                                except Exception:
                                    pass
                            elif op_c == "lte":
                                try:
                                    if float(r_val) <= float(val):
                                        new_filt.append(r)
                                except Exception:
                                    pass
                            elif op_c == "contains" and str(val).lower() in str(r_val or "").lower():
                                new_filt.append(r)
                        filtered = new_filt
            elif isinstance(filt, dict):
                filtered = [
                    r for r in filtered
                    if isinstance(r, dict) and all(
                        v in (None, "") or r.get(k) == v or str(r.get(k) or "").lower() == str(v).lower()
                        for k, v in filt.items()
                    )
                ]

        order_by = payload.get("orderBy")
        if order_by and isinstance(order_by, str):
            desc = payload.get("orderDirection") == "desc"
            def sort_key(item):
                v = item.get(order_by, "") if isinstance(item, dict) else ""
                try:
                    return (0, float(v))
                except Exception:
                    return (1, str(v))
            filtered.sort(key=sort_key, reverse=desc)

        total = len(filtered)
        try:
            offset = int(payload.get("offset") or 0)
        except Exception:
            offset = 0
        try:
            limit = int(payload.get("limit") or 0)
        except Exception:
            limit = 0

        paged = filtered
        if limit > 0:
            paged = filtered[offset:offset + limit]
        elif offset > 0:
            paged = filtered[offset:]

        context.variables["total"] = total
        context.outputs["total"] = total
        context.variables["value"] = paged
        context.outputs["value"] = paged
        return paged

class MockApiAdapter:
    async def execute(self, action: str, payload: dict, context: Any) -> Any:
        mock_val = payload.get("mock")
        if isinstance(mock_val, str) and mock_val.strip():
            try:
                return json.loads(mock_val)
            except Exception:
                pass
        return {"ok": True, "status": 200, "data": payload.get("body")}

class MockDelayAdapter:
    def __init__(self, fast: bool = False):
        self.fast = fast

    async def execute(self, duration_ms: float):
        if self.fast or duration_ms <= 0:
            await asyncio.sleep(0)
            return
        await asyncio.sleep(duration_ms / 1000.0)

BUILTIN_OPERATIONS = {
    "validate_required": lambda v, *a: v is not None and str(v).strip() != "",
    "validate_email": lambda v, *a: bool(v is not None and re.match(r"^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$", str(v).strip())),
    "validate_minLength": lambda v, p=6, *a: len(str(v or "")) >= (int(p) if str(p).isdigit() else 6),
    "validate_maxLength": lambda v, p=100, *a: len(str(v or "")) <= (int(p) if str(p).isdigit() else 100),
    "validate_numeric": lambda v, *a: (
        False if v is None or not str(v).strip() else (
            float(str(v).strip()) is not None if str(v).strip().replace('.', '', 1).replace('-', '', 1).isdigit() else False
        )
    ),
    "validate_cpf": lambda v, *a: (
        lambda clean: len(clean) == 11 and clean != clean[0] * 11
    )(re.sub(r"\\D", "", str(v or ""))),
    "validate_regex": lambda v, p=".*", *a: bool(re.search(str(p or ".*"), str(v or ""))),
    "math_add": lambda a, b=0, *x: (float(a or 0) + float(b or 0)),
    "math_sub": lambda a, b=0, *x: (float(a or 0) - float(b or 0)),
    "math_mul": lambda a, b=0, *x: (float(a or 0) * float(b or 0)),
    "math_div": lambda a, b=1, *x: ((float(a or 0) / float(b)) if float(b or 0) != 0 else 0),
    "math_mod": lambda a, b=1, *x: ((float(a or 0) % float(b)) if float(b or 0) != 0 else 0),
    "math_pow": lambda a, b=1, *x: (float(a or 0) ** float(b or 0)),
    "math_round": lambda a, *x: round(float(a or 0)),
    "math_abs": lambda a, *x: abs(float(a or 0)),
    "text_concat": lambda a="", b="", *x: (str(a if a is not None else "") + str(b if b is not None else "")),
    "text_upper": lambda a="", *x: str(a if a is not None else "").upper(),
    "text_lower": lambda a="", *x: str(a if a is not None else "").lower(),
    "text_trim": lambda a="", *x: str(a if a is not None else "").strip(),
    "text_split": lambda a="", sep=",", *x: str(a if a is not None else "").split(str(sep or ",")),
    "text_replace": lambda a="", s="", r="", *x: str(a if a is not None else "").replace(str(s or ""), str(r or "")),
    "object_create": lambda d=None, *x: (
        dict(d) if isinstance(d, dict) else (
            json.loads(d) if isinstance(d, str) and d.strip().startswith("{") else {"value": d}
        )
    ),
    "array_create": lambda i=None, *x: (
        list(i) if isinstance(i, list) else (
            [i] if i is not None and i != "" else []
        )
    )
}

class RuntimeAdapters:
    def __init__(self, fast_delay: bool = False):
        self.auth = MockAuthAdapter()
        self.api = MockApiAdapter()
        self.database = MockDatabaseAdapter()
        self.delay = MockDelayAdapter(fast=fast_delay)

class RuntimeContext:
    def __init__(
        self,
        inputs: Optional[Dict[str, Any]] = None,
        store: Optional[Dict[str, Any]] = None,
        variables: Optional[Dict[str, Any]] = None,
        screen: Optional[str] = None,
        outputs: Optional[Dict[str, Any]] = None,
        notifications: Optional[List[Any]] = None,
        logs: Optional[List[str]] = None,
        trace: Optional[List[Dict[str, Any]]] = None,
        max_steps: int = 100,
        adapters: Optional[RuntimeAdapters] = None,
        fast_delay: bool = False,
    ):
        self.inputs = dict(inputs or {})
        self.store = store if store is not None else {}
        self.variables = dict(variables or {})
        self.screen = screen
        self.outputs = dict(outputs or {})
        self.notifications = list(notifications or [])
        self.logs = list(logs or [])
        self.trace = list(trace or [])
        self.step_count = 0
        self.max_steps = max_steps
        self.fast_delay = fast_delay
        self.adapters = adapters or RuntimeAdapters(fast_delay=fast_delay)
`;
