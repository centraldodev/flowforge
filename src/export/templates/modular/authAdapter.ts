export const authAdapterSource = `
const DEMO_USER = { email: "demo@exemplo.com", password: "123456", nome: "Usuário Demo" };

export class MockAuthAdapter {
  async execute(action, payload, context) {
    let email = String(payload.email || "");
    let password = String(payload.password || "");

    if (!email) {
      const emailKey = Object.keys(context.inputs).find((k) => k.toLowerCase().includes("email"));
      if (emailKey) email = String(context.inputs[emailKey] ?? "");
    }
    if (!password) {
      const passKey = Object.keys(context.inputs).find(
        (k) => k.toLowerCase().includes("senha") || k.toLowerCase().includes("password")
      );
      if (passKey) password = String(context.inputs[passKey] ?? "");
    }

    const dbTable = "usuarios";
    const dbRows = (context.store[dbTable] ??= [
      { id: 1, ...DEMO_USER, senha: DEMO_USER.password, provider: "email" }
    ]);

    if (action === "google") {
      const googleEmail = "google.teste@gmail.com";
      const mockToken = "ya29.a0AfH6SMC_MOCK_TOKEN_GOOGLE_FLOWFORGE_SECURE";
      const googleUser = { id: 2, nome: "Google Teste", email: googleEmail, provider: "google", token: mockToken };
      const existing = dbRows.find((u) => u.email === googleEmail);
      if (existing) {
        existing.token = mockToken;
        existing.provider = "google";
      } else {
        dbRows.push(googleUser);
      }
      context.store.__session = [googleUser];
      return googleUser;
    }

    if (action === "register") {
      const exists = dbRows.some((u) => u.email === email);
      if (exists) {
        delete context.store.__session;
        throw new Error("E-mail já cadastrado no banco de dados");
      }
      if (!email.includes("@") || password.length < 6) {
        delete context.store.__session;
        throw new Error("Use e-mail válido e senha com 6 caracteres");
      }
      const newUser = { id: dbRows.length + 1, nome: email.split("@")[0], email, senha: password, provider: "email" };
      dbRows.push(newUser);
      context.store.__session = [newUser];
      return newUser;
    }

    const userInDb = dbRows.find((u) => u.email === email && (u.senha === password || u.password === password));
    if (userInDb) {
      context.store.__session = [userInDb];
      return userInDb;
    }
    if (email === DEMO_USER.email && password === DEMO_USER.password) {
      context.store.__session = [DEMO_USER];
      return DEMO_USER;
    }

    delete context.store.__session;
    throw new Error("E-mail ou senha incorretos");
  }
}

`;
