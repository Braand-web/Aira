// The local demo adapter may talk to loopback only, even if configured incorrectly.
import net from 'node:net';
import tls from 'node:tls';
import {syncBuiltinESMExports} from 'node:module';

function local(host) {
  if (!['localhost','127.0.0.1','::1','[::1]'].includes(String(host).toLowerCase())) throw Error('La démonstration ne peut pas contacter un service externe.');
}
function socket(args) {
  const first = args[0];
  if (Array.isArray(first)) return socket(first);
  if (first && typeof first === 'object') {
    if (first.path && !first.host && !first.hostname) return;
    local(first.host ?? first.hostname ?? 'localhost');
  } else if (typeof first === 'number' || /^\d+$/u.test(String(first))) local(typeof args[1] === 'string' ? args[1] : 'localhost');
}
const connect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function (...args) {socket(args); return Reflect.apply(connect, this, args);};
const tlsConnect = tls.connect;
tls.connect = function (...args) {socket(args); return Reflect.apply(tlsConnect, this, args);};
const fetch = globalThis.fetch;
globalThis.fetch = (input, init) => {local(new URL(input instanceof Request ? input.url : input).hostname); return fetch(input, init);};
syncBuiltinESMExports();
