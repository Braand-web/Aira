import assert from "node:assert/strict";
import {createServer} from "node:http";
import net from "node:net";
import tls from "node:tls";
import test from "node:test";
import "./offline-network.mjs";

test("offline tests reject real provider fetch and sockets before connection", async () => {
  await assert.rejects(fetch("https://example.invalid/provider"), {code: "ERR_BRAAND_OFFLINE"});
  const socket = new net.Socket();
  try {
    assert.throws(() => socket.connect({host: "example.invalid", port: 443}), {code: "ERR_BRAAND_OFFLINE"});
    assert.throws(() => net.createConnection(443, "example.invalid"), {code: "ERR_BRAAND_OFFLINE"});
    assert.throws(() => tls.connect({host: "example.invalid", port: 443}), {code: "ERR_BRAAND_OFFLINE"});
  } finally {
    socket.destroy();
  }
});

test("offline HTTP integration can reach only its local test server", async () => {
  const server = createServer((_request, response) => response.end("fixture"));
  await new Promise((resolve, reject) => server.once("error", reject).listen(0, "127.0.0.1", resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/`);
    assert.equal(await response.text(), "fixture");
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
