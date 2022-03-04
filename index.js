const Maker = require("./maker")
class Mushies {
  async maker (o) {
    let maker = new Maker(o)
    await maker.init()
    return maker
  }
  core(o) {
    let maker = new Maker(o)
    return maker
  }
}
const mushies = new Mushies();
module.exports = mushies
