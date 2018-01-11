require('dotenv').config()

const aws = require('aws-sdk')
const a4b = new aws.AlexaForBusiness()
const alexa = require('alexa-app')
const mmf = new alexa.app('mmf')

const debug = require('debug')('alexa.test')

const app = require('express')()
const PORT = process.env.PORT || 5000

app.listen(PORT, () => {
  console.log('Listening on port: ', PORT)
})

mmf.express({
  expressApp: app,
  router: undefined,
  preRequest: undefined,
  postRequest: undefined,
  checkCert: true,
  endpoint: 'alexa',
  debug: true
})

mmf.launch((request, response) => {
  debug(request.userId)
  const title = 'Hi, MMF assistant here.'
  const msg = 'I can help you quickly create an appointment on the store calendar, or give a flash briefing of your daily sales status'
  response.say(title + msg)
  response.card(title, msg)
  response.shouldEndSession(false)
})

mmf.intent('AMAZON.HelpIntent', undefined, (request, response) => {
  let msg = 'you can ask - "how much is ombre" to check price, or say - "book digital perm tomorrow at 2pm" to make an appointment.'
  response.say(msg)
  response.shouldEndSession(false)
})

mmf.intent('AMAZON.StopIntent', undefined, (request, response) => {
  let msg = 'OK. Got it.'
  response.say(msg)
})

mmf.intent('AMAZON.CancelIntent', undefined, (request, response) => {
  let msg = 'No problem. Request cancelled.'
  response.say(msg)
})

mmf.intent('GetNewFactIntent', undefined, (request, response) => {
  debug(JSON.stringify(request, null, 2))
  const index = Math.floor(Math.random() * facts.length)
  response.say(facts[index])
  response.shouldEndSession(true)
})

/**
 * users
 */
app.get('/users', (req, res) => {
  // let params = {
  //   Filters: [
  //     {
  //       Key: 'UserArn',
  //       Values: []
  //     }
  //   ]
  // }
  a4b.searchUsers(undefined, (err, data) => {
    if (err) {
      debug(err)
      res.send(err)
    } else {
      res.send(data)
    }
  })
})

/**
 * sanity
 */
app.get('/test', (req, res) => {
  res.send('test' + new Date())
})

/**
 * localtunnel
 */
const localtunnel = require('localtunnel')
if (process.env.LOCALTUNNEL === 'true') {
  let tunnel = localtunnel(PORT, {
    subdomain: process.env.LOCALTUNNEL_SUBDOMAIN
  }, (err, tunnel) => {
    if (err) {
      debug(err)
      // let exit = process.exit
    }
    debug('localhost is now tunnelling through', tunnel.url)
    // cleanup localtunnel
    process.on('exit', () => {
      tunnel.close()
    })
  })

  tunnel.on('close', function () {
    debug('localhost is no longer tunnelling through', tunnel.url)
  })
}

const facts = [
  'A year on Mercury is just 88 days long.',
  'Despite being farther from the Sun, Venus experiences higher temperatures than Mercury.',
  'Venus rotates counter-clockwise, possibly because of a collision in the past with an asteroid.',
  'On Mars, the Sun appears about half the size as it does on Earth.',
  'Earth is the only planet not named after a god.',
  'Jupiter has the shortest day of all the planets.',
  'The Milky Way galaxy will collide with the Andromeda Galaxy in about 5 billion years.',
  'The Sun contains 99.86% of the mass in the Solar System.',
  'The Sun is an almost perfect sphere.',
  'A total solar eclipse can happen once every 1 to 2 years. This makes them a rare event.',
  'Saturn radiates two and a half times more energy into space than it receives from the sun.',
  'The temperature inside the Sun can reach 15 million degrees Celsius.',
  'The Moon is moving approximately 3.8 cm away from our planet every year.'
]
