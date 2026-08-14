export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const cors = corsHeaders(env);

    if (request.method === "OPTIONS") return new Response(null, {headers:cors});

    if (url.pathname === "/") {
      return html('<h1>Taco Bank Authentication</h1><p><a href="/login">Sign in with Discord</a></p>');
    }

    if (url.pathname === "/login") {
      if (!env.DISCORD_CLIENT_ID || !env.DISCORD_CLIENT_SECRET || !env.FRONTEND_URL || !env.SESSION_SECRET) {
        return new Response("Worker variables are incomplete.", {status:500});
      }

      const state = crypto.randomUUID();
      const redirectUri = `${url.origin}/callback`;
      const auth = new URL("https://discord.com/oauth2/authorize");
      auth.searchParams.set("client_id", env.DISCORD_CLIENT_ID);
      auth.searchParams.set("response_type","code");
      auth.searchParams.set("redirect_uri",redirectUri);
      auth.searchParams.set("scope","identify");
      auth.searchParams.set("state",state);

      const headers = new Headers({Location:auth.toString()});
      headers.append("Set-Cookie",`oauth_state=${state}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=600`);
      return new Response(null,{status:302,headers});
    }

    if (url.pathname === "/callback") {
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const cookies = parseCookies(request.headers.get("Cookie") || "");
      if (!code || !returnedState || returnedState !== cookies.oauth_state) {
        return new Response("Invalid Discord login. Please try again.", {status:400});
      }

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
      if (!tokenResponse.ok) return new Response("Discord token exchange failed.",{status:500});

      const discordToken = await tokenResponse.json();
      const userResponse = await fetch("https://discord.com/api/v10/users/@me", {
        headers:{Authorization:`Bearer ${discordToken.access_token}`}
      });
      if (!userResponse.ok) return new Response("Could not read Discord account.",{status:500});
      const user = await userResponse.json();

      const now = Math.floor(Date.now()/1000);
      const payload = {
        sub:user.id,
        username:user.username,
        global_name:user.global_name || null,
        iat:now,
        exp:now + 86400
      };
      const sessionToken = await signToken(payload, env.SESSION_SECRET);

      const frontend = env.FRONTEND_URL.replace(/\/$/, "");
      const location = `${frontend}/#auth=${encodeURIComponent(sessionToken)}`;
      return Response.redirect(location, 302);
    }

    if (url.pathname === "/me") {
      const auth = request.headers.get("Authorization") || "";
      if (!auth.startsWith("Bearer ")) return json({loggedIn:false},401,cors);

      const token = auth.slice(7);
      const payload = await verifyToken(token, env.SESSION_SECRET);
      if (!payload) return json({loggedIn:false},401,cors);

      return json({
        loggedIn:true,
        user:{
          id:payload.sub,
          username:payload.username,
          global_name:payload.global_name
        }
      },200,cors);
    }

    return new Response("Not Found",{status:404});
  }
};

function corsHeaders(env) {
  let origin = "";
  try { origin = new URL(env.FRONTEND_URL).origin; } catch {}
  return {
    "Access-Control-Allow-Origin":origin,
    "Access-Control-Allow-Headers":"Authorization, Content-Type",
    "Access-Control-Allow-Methods":"GET, POST, OPTIONS",
    "Vary":"Origin"
  };
}

async function signToken(payload, secret) {
  const body = base64url(JSON.stringify(payload));
  const sig = await hmac(body, secret);
  return `${body}.${sig}`;
}

async function verifyToken(token, secret) {
  try {
    const [body,sig] = token.split(".");
    if (!body || !sig) return null;
    const expected = await hmac(body, secret);
    if (!timingSafeEqual(sig, expected)) return null;
    const payload = JSON.parse(fromBase64url(body));
    if (!payload.exp || payload.exp < Math.floor(Date.now()/1000)) return null;
    return payload;
  } catch { return null; }
}

async function hmac(data, secret) {
  const key = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(secret),
    {name:"HMAC",hash:"SHA-256"}, false, ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  return bytesToBase64url(new Uint8Array(signature));
}

function timingSafeEqual(a,b) {
  if (a.length !== b.length) return false;
  let diff=0;
  for (let i=0;i<a.length;i++) diff |= a.charCodeAt(i)^b.charCodeAt(i);
  return diff===0;
}
function base64url(s){return bytesToBase64url(new TextEncoder().encode(s))}
function bytesToBase64url(bytes){
  let bin=""; for(const b of bytes) bin+=String.fromCharCode(b);
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}
function fromBase64url(s){
  let b=s.replace(/-/g,"+").replace(/_/g,"/"); while(b.length%4)b+="=";
  const bin=atob(b); return new TextDecoder().decode(Uint8Array.from(bin,c=>c.charCodeAt(0)));
}
function parseCookies(header){
  const out={}; for(const p of header.split(";")){const i=p.indexOf("=");if(i<0)continue;out[p.slice(0,i).trim()]=p.slice(i+1).trim()} return out;
}
function json(data,status,headers){return new Response(JSON.stringify(data),{status,headers:{...headers,"Content-Type":"application/json"}})}
function html(s){return new Response(s,{headers:{"Content-Type":"text/html;charset=UTF-8"}})}
