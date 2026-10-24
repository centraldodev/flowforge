# Proposta de Extensão da IR e Sistema de Tipos (Fase 7)

## 1. Visão Geral
A Fase 7 introduz uma linguagem visual portável para transformações de dados, cálculos, lógica e construções de objetos/listas sem a necessidade de escrever código textual JavaScript no bloco `function`.

## 2. Novos Blocos do Primeiro Lote
1. **constant**:
   - Portas: Saída de controle `next` e saída de dados `value`.
   - Config: `valueType` ('string' | 'number' | 'boolean' | 'json'), `value`.
2. **math**:
   - Portas: Entradas de dados `a` (number) e `b` (number), saída de dados `result` (number).
   - Operações: `add`, `sub`, `mul`, `div`, `mod`, `pow`, `round`, `abs`.
3. **text**:
   - Portas: Entradas de dados `value` (string) e argumentos opcionais (`arg`, `separator`), saída de dados `result` (string ou array).
   - Operações: `concat`, `upper`, `lower`, `trim`, `split`, `replace`.
4. **compare**:
   - Portas: Entradas de dados `left` (any) e `right` (any), saída de controle `then` (true) / `else` (false), saída de dados `result` (boolean).
   - Operações: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `contains`.
5. **boolean**:
   - Portas: Entradas de dados `a` (boolean) e `b` (boolean opcional para not), saída de dados `result` (boolean).
   - Operações: `and`, `or`, `not`.
6. **object**:
   - Portas: Entradas de dados configuráveis por chave ou portas dinâmicas, saída de dados `object`.
7. **array**:
   - Portas: Entradas de dados conectadas, saída de dados `array`.

## 3. Extensões na IR (`ExprIR` e `InstructionIR`)
- Suporte a operadores binários adicionais: `mul`, `div`, `mod`.
- Operações de biblioteca padronizadas em `BUILTIN_OPERATIONS`:
  - `text_upper(v)`, `text_lower(v)`, `text_trim(v)`, `text_concat(a, b)`, `text_replace(str, search, rep)`
  - `math_round(v)`, `math_abs(v)`, `math_pow(a, b)`
  - `object_create(keys, values)`, `array_create(...items)`

## 4. Diagnóstico de Incompatibilidade Multi-Linguagem
- Blocos `function` com JavaScript textual manual receberão o diagnóstico:
  `FUNCTION_NOT_PORTABLE_PYTHON`
  ao exportar para Python ou executar análise multi-linguagem.
