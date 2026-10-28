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

export const darkModeStyleAdditions = `
/* Suporte a Modo Noturno */
[data-theme="dark"] body {
  background: #0f1117;
  color: #f8fafc;
}
[data-theme="dark"] main {
  background: #181b22;
  color: #f8fafc;
  border: 1px solid #282c37;
}
[data-theme="dark"] input,
[data-theme="dark"] textarea,
[data-theme="dark"] select {
  background: #12141a;
  border-color: #3b4254;
  color: #f8fafc;
}
[data-theme="dark"] .message {
  background: #25243a;
  color: #e4def7;
}
.theme-switch-bar {
  display: flex;
  gap: 6px;
  justify-content: flex-end;
  margin-bottom: 14px;
}
.theme-switch-bar button {
  padding: 4px 8px;
  font-size: 11px;
  background: transparent;
  border: 1px solid #ccc;
  color: inherit;
  border-radius: 4px;
  cursor: pointer;
}
.theme-switch-bar button.active {
  background: #8470bb;
  color: white;
  border-color: #8470bb;
}
`;

export const darkModeHtmlTemplate = `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <script>
      (function() {
        var t = localStorage.getItem('app_theme') || 'system';
        var d = t === 'dark' || (t === 'system' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
        if (d) document.documentElement.setAttribute('data-theme', 'dark');
        else document.documentElement.setAttribute('data-theme', 'light');
      })();
    </script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`;
