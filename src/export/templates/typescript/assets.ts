export const styleTemplate = `body {
  margin: 0;
  background: #f3f4f8;
  color: #242637;
  font: 14px system-ui;
}
main {
  max-width: 420px;
  margin: 6vh auto;
  padding: 32px;
  background: white;
  border-radius: 18px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 18px 0;
}
input,
textarea,
select,
button {
  font: inherit;
  padding: 12px;
  border: 1px solid #dadce5;
  border-radius: 8px;
}
input,
textarea,
select {
  background: white;
  color: #242637;
}
button {
  background: #8470bb;
  color: white;
  cursor: pointer;
}
.wide {
  width: 100%;
  margin-top: 12px;
}
.checkbox-field {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 16px 0;
}
hr {
  border: 0;
  border-top: 1px solid #ddd;
  margin: 20px 0;
}
pre {
  white-space: pre-wrap;
  font-size: 12px;
}
.message {
  padding: 12px;
  background: #eee8fa;
  border-radius: 8px;
  margin-top: 12px;
}
`;

export const htmlTemplate = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
