import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const context = {};
runInNewContext(readFileSync("public/prototype/navigation.js", "utf8"), context);
const { allowed, resolve, visit } = context.FrogNavigation;

test("refresh retains the last opened page using its URL hash", () => {
  let route = "";
  const location = { pathname: "/prototype/index.html", search: "", hash: "" };
  const history = {
    replaceState(_state, _title, url) {
      route = url;
      location.hash = url.slice(url.indexOf("#"));
    },
  };
  assert.equal(visit("orders", "owner", location, history), "orders");
  assert.equal(route, "/prototype/index.html#orders");
  assert.equal(resolve(location.hash, "owner"), "orders");
  assert.equal(visit("reports", "owner", location, history), "reports");
  assert.equal(resolve(location.hash, "owner"), "reports");
});

test("navigation does not strip existing URL query parameters", () => {
  let url;
  visit(
    "customers",
    "owner",
    { pathname: "/prototype/index.html", search: "?mode=demo" },
    {
      replaceState(_state, _title, next) {
        url = next;
      },
    },
  );
  assert.equal(url, "/prototype/index.html?mode=demo#customers");
});

test("staff routes cannot expose owner-only pages", () => {
  for (const restricted of ["products", "customers"]) {
    assert.equal(allowed(restricted, "staff"), false);
    assert.equal(resolve("#" + restricted, "staff"), "dashboard");
  }
  assert.equal(resolve("#orders", "staff"), "orders");
  assert.equal(resolve("#customers", "owner"), "customers");
});

test("unknown or malformed hashes fall back to Overview", () => {
  for (const hash of ["", "#no-page", "#../orders", "#%ZZ", "#orders?x=1"])
    assert.equal(resolve(hash, "owner"), "dashboard");
});

test("reset always rewrites the URL to Overview", () => {
  let url = "";
  const result = visit(
    "dashboard",
    "owner",
    { pathname: "/prototype/index.html", search: "" },
    {
      replaceState(_state, _title, value) {
        url = value;
      },
    },
  );
  assert.equal(result, "dashboard");
  assert.equal(url, "/prototype/index.html#dashboard");
});

test("app integrates navigation and validates cross-tab storage without changing order data", () => {
  const app = readFileSync("public/prototype/app.js", "utf8");
  const html = readFileSync("public/prototype/index.html", "utf8");
  assert.match(app, /FrogNavigation\.visit\(next, state\.role/);
  assert.match(app, /FrogNavigation\.resolve\(window\.location\.hash/);
  assert.match(app, /FrogPersistence\.read\(localStorage\)/);
  assert.doesNotMatch(app, /e\.key === STORAGE/);
  assert.ok(html.indexOf("navigation.js") < html.indexOf("app.js"));
});
