const os = require('os')
const bip39 = require('bip39')
const crypto = require('crypto');
const chalk = require('chalk');
const HDKey = require('hdkey')
const fs = require('fs')
const inquirer = require('inquirer');
const walletPath = os.homedir() + "/.mushie"
class Mushie {
  constructor(o) {
    if (!o.key) {
      throw new Error("'key' attribute must exist")
    }
    this.path = o.key
  }
  init(o) {
    this.key = o.key
    if (o.use) {
      for (let key in o.use) {
        this[key] = o.use[key](this.key)
      }
    }
  }
}
class Maker {
  constructor(o) {
    this.store = (o && o.store ? o.store : walletPath)
    this.decryption_password = (o && o.decryption_password)
  }
  async init(o) {
    let seedExists = await this.exists(this.store)
    if (!seedExists) {
      try {
        await this.menu()
      } catch (e) {
        console.log(e)
        process.exit(1)
      }
    }
    let s = await this.exportSeed()
    let buf = await bip39.mnemonicToSeed(s)
    this.hdkey = HDKey.fromMasterSeed(buf)
  }
  make(o) {
    let mushie = new Mushie(o)
    let key = this.hdkey.derive(mushie.path)
    mushie.init({ key: key, use: o.use, decryption_password: o.decryption_password })
    return mushie
  }
  exists(p) {
    return new Promise((resolve, reject) => {
      fs.access(p, fs.F_OK, (err) => {
        resolve(!err)
      })
    })
  }
  warn() {
    console.log("#####################################################################")
    console.log("#")
    console.log("# " + chalk.rgb(250, 50, 0)(" WARNING"))
    console.log("#")
    console.log("#  " + chalk.rgb(250, 50, 0)("You already have a wallet seed!"))
    console.log("#  " + chalk.rgb(250, 50, 0)("If you really want to overwrite, delete the seed file and retry."))
    console.log("#")
    console.log("#  1. The seed file can be found at:")
    console.log("#")
    console.log("#     " + chalk.yellow(this.store))
    console.log("#")
    console.log("#  2. Before deleting, install the mushie wallet globally with")
    console.log("#")
    console.log("#     " + chalk.yellow("npm install -g mushie"))
    console.log("#")
    console.log("#     and backup the seed by running:")
    console.log("#")
    console.log("#     " + chalk.yellow("mushie export"))
    console.log("#")
    console.log("#  3. After exporting, you can delete the seed by running:")
    console.log("#")
    console.log("#     " + chalk.yellow("rm " + this.store))
    console.log("#")
    console.log("#####################################################################")
  }
  encrypt(text, password) {
    const iv = crypto.randomBytes(16);
    const key = crypto.createHash('sha256').update(password).digest();
    let cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    let tag = cipher.getAuthTag();
    return {
      iv: iv.toString('hex'),
      data: encrypted.toString('hex'),
      tag: tag.toString("hex")
    };
  }
  decrypt(encrypted, password) {
    const iv = Buffer.from(encrypted.iv, 'hex');
    const key = crypto.createHash("sha256").update(password).digest()
    const tag = Buffer.from(encrypted.tag, 'hex');
    const encryptedText = Buffer.from(encrypted.data, 'hex');
    let decipher = crypto.createDecipheriv("aes-256-gcm", key, iv)
    decipher.setAuthTag(tag)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    return decrypted.toString()
  }
  async exportSeed() {
    let se = await fs.promises.readFile(this.store, "utf8")
    let s = JSON.parse(se)
    let answers = { password: this.decryption_password }

    if (!this.decryption_password) {
      answers = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        mask: "*",
        message: 'Enter decryption password'
      }])
    }

    if (answers.password.length > 0) {
      try {
        let decrypted = this.decrypt(s, answers.password)
        return decrypted.trim()
      } catch (e) {
        console.log("E", e)
        throw new Error("incorrect password")
      }
    } else {
      throw new Error("Please enter decryption password")
    }
  }
  async importSeed() {
    let seedExists = await this.exists(this.store)
    if (seedExists) {
      this.warn()
    } else {
      let answers = await inquirer.prompt([{
        type: 'input',
        name: 'seed',
        message: 'Please enter the seed phrase',
      }])
      if (answers.seed.length > 0) {
        let phrase = answers.seed
        let a = await inquirer.prompt([{
          type: 'password',
          name: 'password',
          mask: "*",
          message: 'Please enter encryption password',
          validate: (i) => {
            return (i.length > 0 ? true : "Please enter password")
          }
        }])
        if (a.password.length > 0) {
          let encrypted = this.encrypt(phrase, a.password)
          await fs.promises.writeFile(this.store, JSON.stringify(encrypted))
        } else {
          await fs.promises.writeFile(this.store, phrase)
        }
        console.log("Seed successfully stored at:", this.store)
      } else {
        console.log("the seed phrase is empty. please retry.")
      }
    }
  }
  async generateSeed() {
    let seedExists = await this.exists(this.store)
    if (seedExists) {
      this.warn()
    } else {
      const m = bip39.generateMnemonic()
      let answers = await inquirer.prompt([{
        type: 'password',
        name: 'password',
        mask: "*",
        message: 'Please enter encryption password',
        validate: (i) => {
          return (i.length > 0 ? true : "Please enter password")
        }
      }])
      if (answers.password.length > 0) {
        let encrypted = this.encrypt(m, answers.password)
        await fs.promises.writeFile(this.store, JSON.stringify(encrypted))
        return {
          seed: m,
          encrypted
        }
      } else {
        console.log("Please enter password")
        await fs.promises.writeFile(this.store, m)
      }
      console.log("Seed successfully stored at:", this.store)
    }
  }
  async menu() {
    let answers = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'What do you want to do?',
      choices: [
        { name: "generate a new wallet seed", value: 0 },
        { name: "import a seed phrase", value: 1 },
        { name: "export seed phrase", value: 2 }
      ]
    }])
    if (answers.action === 0) {
      let { encrypted, seed } = await this.generateSeed()
      console.log("Please write down the following seed phrase somewhere:\n")
      console.log("\t" + seed)
    } else if (answers.action === 1) {
      await this.importSeed()
    } else if (answers.action === 2) {
      let seed = await this.exportSeed()
      console.log(seed)
    }
  }
}
module.exports = Maker
