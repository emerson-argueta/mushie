const eccrypto = require('eccrypto');
const crypto = require('crypto');
const mushie = require('../index');
const elliptic = (key) => {
  return {
    secret: async (pubkey) => {
      return eccrypto.derive(key.privateKey, pubkey)
    },
    send: async (o) => {
      let msg = o.msg
      let publicKey = o.to
      if (typeof msg === "string") msg = Buffer.from(msg)
      return eccrypto.encrypt(publicKey, msg)
    },
    receive: async (o) => {
      let msg = o.msg
      if (typeof msg === "string") msg = Buffer.from(msg)
      return eccrypto.decrypt(key.privateKey, msg)
    },
    sign: async (o) => {
      let msg = o.msg
      let buf = crypto.createHash("sha256").update(msg).digest()
      const s = await eccrypto.sign(key.privateKey, buf)
      return Buffer.from(s)
    },
    verify: async (o) => {
      let msg = o.msg
      let sig = o.sig
      let buf = crypto.createHash("sha256").update(msg).digest()
      try {
        let res = await eccrypto.verify(key.publicKey, buf, sig)
        return true;
      } catch (e) {
        return false;
      }
    }
  }
};
(async () => {
  let maker = await mushie.maker()
  let alice = maker.make({
    key: "m'/44'/60'/0'/0/0",
    use: { elliptic }
  });
  let bob = maker.make({
    key: "m'/44'/60'/0'/0/1",
    use: { elliptic }
  });
  let encrypted = await alice.elliptic.send({
    msg: "hi bob",
    to: bob.key.publicKey
  })
  console.log("encrypted message = ", encrypted)
  try {
    let decrypted = await bob.elliptic.receive({
      msg: encrypted
    })
    console.log("decrypted = ", decrypted.toString())
  } catch (e) {
    console.log("bob failed to receive from alice")
  }
  try {
    let decrypted2 = await alice.elliptic.receive({
      msg: encrypted
    })
    console.log("decrypted2 = ", decrypted2.toString())
  } catch (e) {
    console.log("alice failed to receive from alice herself")
  }
})();
