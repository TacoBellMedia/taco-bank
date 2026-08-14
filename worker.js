export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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

      return new Response(null, {
        status: 302,
        headers: {
          "Location": auth.toString(),
          "Set-Cookie": `oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`
        }
      });
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const state = url.searchParams.get("state");
      const cookies = Object.fromEntries(
        (request.headers.get("Cookie") || "").split(";").filter(Boolean).map(x => {
          const i=x.indexOf("="); return [x.slice(0,i).trim(),x.slice(i+1).trim()];
        })
      );

      if (!code || !state || state !== cookies.oauth_state)
        return new Response("Invalid Discord login.", {status:400});

      const redirectUri = `${url.origin}/callback`;

      const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
        method:"POST",
        headers:{"Content-Type":"application/x-www-form-urlencoded"},
        body:new URLSearchParams({
          client_id:env.DISCORD_CLIENT_ID,
          client_secret:env.DISCORD_CLIENT_SECRET,
          grant_type:"authorization_code",
          code,
          redirect_uri:redirectUri
        })
      });

      if (!tokenResponse.ok)
        return new Response("Discord token exchange failed.", {status:500});

      const token = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers:{Authorization:`Bearer ${token.access_token}`}
      });

      if (!userResponse.ok)
        return new Response("Could not read Discord account.", {status:500});

      const user = await userResponse.json();

      // LOGIN TEST ONLY. Upgrade to a signed server-side session before real withdrawals.
      const session = btoa(JSON.stringify({id:user.id, username:user.username}));

      return new Response(null, {
        status:302,
        headers:{
          "Location":env.FRONTEND_URL,
          "Set-Cookie":`taco_session=${session}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=86400`
        }
      });
    }

    return new Response("Not Found", {status:404});
  }
};
