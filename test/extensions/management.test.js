import { test } from "node:test";
import assert from "node:assert/strict";
import { generateToken, checkAuth } from "../../src/middleware/auth.js";
import { handleManagement } from "../../src/extensions/management/index.js";
const sys = {
  username: "example",
  password: "synthetic-test-hash",
  jwt_secret: "a".repeat(64),
};
const env = { API_SECRET: "b".repeat(64), MANAGEMENT_ENABLED: "true" };
async function request(path = "/users", method = "GET", headers = {}) {
  const token = await generateToken(env, sys);
  return new Request("https://example.test/api/management" + path, {
    method,
    headers: { Authorization: "Bearer " + token, ...headers },
    body: method === "GET" ? undefined : "{}",
  });
}
test("extension disabled, missing binding, missing administrator and anonymous fail closed", async () => {
  assert.equal(
    (
      await handleManagement(
        await request(),
        { ...env, MANAGEMENT_ENABLED: "false" },
        sys,
      )
    ).status,
    404,
  );
  assert.equal((await handleManagement(await request(), env, sys)).status, 503);
  assert.equal(
    (await handleManagement(await request(), env, { ...sys, password: "" }))
      .status,
    503,
  );
  assert.equal(
    (
      await handleManagement(
        new Request("https://example.test/api/management/users"),
        env,
        sys,
      )
    ).status,
    401,
  );
});
test("valid native cookie/bearer reused; credentials change invalidates newly issued token", async () => {
  const token = await generateToken(env, sys);
  for (const headers of [
    { Authorization: "Bearer " + token },
    { Cookie: "cfsm_auth=" + encodeURIComponent(token) },
  ]) {
    const req = new Request("https://example.test/api/management/users", {
      headers,
    });
    assert.equal(
      await checkAuth(req, env, sys, { requireCredentialVersion: true }),
      true,
    );
    assert.equal(
      await checkAuth(
        req,
        env,
        { ...sys, password: "new-hash" },
        { requireCredentialVersion: true },
      ),
      false,
    );
  }
});
test("mutations require same origin and non-simple header; no credentials forwarded", async () => {
  let captured;
  const bound = {
    ...env,
    MANAGEMENT_ADMIN: {
      fetch: async (req) => {
        captured = req;
        return Response.json({ ok: true });
      },
    },
  };
  assert.equal(
    (await handleManagement(await request("/users", "POST"), bound, sys))
      .status,
    403,
  );
  assert.equal(
    (
      await handleManagement(
        await request("/users", "POST", {
          Origin: "https://evil.test",
          "X-CFSM-Management": "1",
          "Content-Type": "application/json",
        }),
        bound,
        sys,
      )
    ).status,
    403,
  );
  const response = await handleManagement(
    await request("/users", "POST", {
      Origin: "https://example.test",
      "X-CFSM-Management": "1",
      "Content-Type": "application/json",
      Cookie: "other=private",
      "X-Admin": "forged",
    }),
    bound,
    sys,
  );
  assert.equal(response.status, 200);
  assert.equal(captured.url, "https://control.internal/v1/users");
  for (const key of ["Authorization", "Cookie", "X-Admin"])
    assert.equal(captured.headers.get(key), null);
  assert.equal(response.headers.get("cache-control"), "no-store");
});
test("no arbitrary admin route, query token, cross-site fetch or error detail leaks", async () => {
  assert.equal(
    (await handleManagement(await request("/secrets"), env, sys)).status,
    404,
  );
  assert.equal(
    (await handleManagement(await request("/users?token=test"), env, sys))
      .status,
    400,
  );
  assert.equal(
    (
      await handleManagement(
        await request("/users", "GET", { "Sec-Fetch-Site": "cross-site" }),
        env,
        sys,
      )
    ).status,
    403,
  );
  const response = await handleManagement(
    await request(),
    {
      ...env,
      MANAGEMENT_ADMIN: {
        fetch() {
          throw new Error("private credential");
        },
      },
    },
    sys,
  );
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes("private credential"));
});
test("signed non-admin, missing expiry, expired and legacy JWTs cannot access extension", async () => {
  const now = Math.floor(Date.now() / 1000);
  async function sign(payload) {
    const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const body = btoa(JSON.stringify(payload));
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(sys.jwt_secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const signature = await crypto.subtle.sign(
      "HMAC",
      key,
      new TextEncoder().encode(header + "." + body),
    );
    return (
      header +
      "." +
      body +
      "." +
      btoa(String.fromCharCode(...new Uint8Array(signature)))
    );
  }
  for (const payload of [
    { sub: "probe", iat: now, exp: now + 60 },
    { sub: "admin", iat: now },
    { sub: "admin", iat: now - 100, exp: now - 1 },
    { sub: "admin", iat: now, exp: now + 60 },
  ]) {
    const token = await sign(payload),
      req = new Request("https://example.test/api/management/users", {
        headers: { Authorization: "Bearer " + token },
      });
    assert.equal((await handleManagement(req, env, sys)).status, 401);
  }
});

test('native admin and management share session requirements when extension is enabled',async()=>{
 const now=Math.floor(Date.now()/1000),header=btoa(JSON.stringify({alg:'HS256',typ:'JWT'}));
 const body=btoa(JSON.stringify({sub:'admin',iat:now,exp:now+600}));
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(sys.jwt_secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const sig=await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(header+'.'+body));
 const legacy=header+'.'+body+'.'+btoa(String.fromCharCode(...new Uint8Array(sig)));
 const req=new Request('https://example.test/admin/api',{headers:{Cookie:'cfsm_auth='+encodeURIComponent(legacy)}});
 assert.equal(await checkAuth(req,{...env,MANAGEMENT_ENABLED:'false'},sys),true);
 assert.equal(await checkAuth(req,env,sys),false);
 const current=await generateToken(env,sys);
 for(const path of ['/admin/api','/api/management/status','/api/management/machines']) {
   const request=new Request('https://example.test'+path,{headers:{Cookie:'cfsm_auth='+encodeURIComponent(current)}});
   assert.equal(await checkAuth(request,env,sys),true);
   assert.equal(await checkAuth(request,env,{...sys,password:'changed'}),false);
 }
});
