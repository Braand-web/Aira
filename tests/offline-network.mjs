// Preloaded in every test process, including local HTTP server children.
// Provider fixtures can replace fetch, but a real socket may only use loopback.
import net from "node:net";
import tls from "node:tls";
import {syncBuiltinESMExports} from "node:module";

function assertLoopback(host) {
  if (["localhost", "127.0.0.1", "::1", "[::1]"].includes(String(host).toLowerCase())) return;
  const error = new Error("External network access is disabled in the offline test suite.");
  error.code = "ERR_BRAAND_OFFLINE";
  throw error;
}

function assertLocalSocket(args) {
  const first = args[0];
  if (Array.isArray(first)) {
    assertLocalSocket(first);
    return;
  }
  if (first && typeof first === "object") {
    if (first.path && !first.host && !first.hostname) return;
    assertLoopback(first.host ?? first.hostname ?? "localhost");
  } else if (typeof first === "number" || /^\d+$/u.test(String(first))) {
    assertLoopback(typeof args[1] === "string" ? args[1] : "localhost");
  }
  // A single string is a local Unix socket or Windows named pipe.
}

const socketConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {
  assertLocalSocket(args);
  return Reflect.apply(socketConnect, this, args);
};
const tlsConnect = tls.connect;
tls.connect = function (...args) {
  assertLocalSocket(args);
  return Reflect.apply(tlsConnect, this, args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = async function (input, init) {
  const url = new URL(input instanceof Request ? input.url : input);
  assertLoopback(url.hostname);
  return originalFetch(input, init);
};
syncBuiltinESMExports();
