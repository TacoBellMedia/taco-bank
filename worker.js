export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    if (url.pathname === "/") {
      return new Response('<h1>Taco Bank Auth</h1><p><a href="/login">Sign in with Discord</a></p>', {
        headers: {"Content-Type":"text/html"}
      });
    }

    if (url.pathname === "/login") {
      const redirectUri = `${url.origin}/callback`;
      const state = crypto.randomUUID();

      const auth = new URL("https://discord.com/oauth2/authorize");
      auth.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      auth.searchParams.set("response_type", "code");
      auth.searchParams.set("redirect_uri", redirectUri);
      auth.searchParams.set("scope", "identify");
      auth.searchParams.set("state", state);

      const headers = new Headers();
      headers.set("Location", auth.toString());
      headers.append("Set-Cookie", `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);

      return new Response(null, { status: 302, headers });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const cookies = parseCookies(request.headers.get("Cookie") || "");

      if (!code || !returnedState || returnedState !== cookies.oauth_state) {
        return new Response("Invalid Discord login.", { status: 400 });
      }

      const redirectUri = `${url.origin}/callback`;

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method: "POST",
        headers: {"Content-Type":"application/x-www-form-urlencoded"},
        body: new URLSearchParams({
          client_id: env.DISCORD_CLIENT_ID,
          client_secret: env.DISCORD_CLIENT_SECRET,
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri
        })
      });

      if (!tokenResponse.ok) {
        return new Response("Discord token exchange failed.", { status: 500 });
      }

      const token = await tokenResponse.json();

      const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers: { Authorization: `Bearer ${token.access_token}` }
      });

      if (!userResponse.ok) {
        return new Response("Could not read Discord account.", { status: 500 });
      }

      const user = await userResponse.json();

      // Login test cookie. Do NOT connect real withdrawals until this is
      // upgraded to a cryptographically signed session.
      const session = encodeURIComponent(btoa(JSON.stringify({
        id: user.id,
        username: user.username,
        global_name: user.global_name || null
      })));

      const headers = new Headers();
      headers.set("Location", env.FRONTEND_URL);
      headers.append("Set-Cookie", `taco_session=${session}; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=86400`);
      headers.append("Set-Cookie", "oauth_state=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0");

      return new Response(null, { status: 302, headers });
    }

    if (url.pathname === "/me") {
      const cookies = parseCookies(request.headers.get("Cookie") || "");

      if (!cookies.taco_session) {
        return json({ loggedIn: false }, 200, cors);
      }

      try {
        const user = JSON.parse(atob(decodeURIComponent(cookies.taco_session)));
        return json({
          loggedIn: true,
          user: {
            id: user.id,
            username: user.username,
            global_name: user.global_name
          }
        }, 200, cors);
      } catch {
        return json({ loggedIn: false }, 200, cors);
      }
    }

    if (url.pathname === "/logout" && request.method === "POST") {
      const headers = new Headers(cors);
      headers.append("Set-Cookie", "taco_session=; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=0");
      return new Response(null, { status: 204, headers });
    }

    return new Response("Not Found", { status: 404 });
  }
};

function parseCookies(header) {
  const out = {};
  for (const p of header.split(";")) {
    const i = p.indexOf("=");
    if (i < 0) continue;
    out[p.slice(0,i).trim()] = p.slice(i+1).trim();
  }
  return out;
}

function corsHeaders(request, env) {
  const frontend = (env.FRONTEND_URL || "").replace(/\/$/, "");
  return {
    "Access-Control-Allow-Origin": frontend,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Vary": "Origin"
  };
}

function json(data, status, headers) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json; charset=UTF-8"
    }
  });
}
