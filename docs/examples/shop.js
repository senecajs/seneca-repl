// A small plugin used by the examples: prices and orders.
module.exports = function shop(options) {
  const prices = { apple: 1.5, pear: 2.25 }

  this.add('role:shop,cmd:price', function (msg, reply) {
    const price = prices[msg.item]
    if (null == price) {
      return reply(new Error('Unknown item: ' + msg.item))
    }
    reply({ item: msg.item, price })
  })

  this.add('role:shop,cmd:order', function (msg, reply) {
    this.act('role:shop,cmd:price', { item: msg.item }, function (err, out) {
      if (err) return reply(err)
      reply({
        item: msg.item,
        quantity: msg.quantity,
        total: out.price * msg.quantity,
      })
    })
  })
}
