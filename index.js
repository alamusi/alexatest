require('dotenv').config()

const alexa = require('alexa-app')
const mmf = new alexa.app('mmf')
const request = require('request')
const crypto = require('crypto-js')
const uuidv4 = require('uuid/v4')

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
  endpoint: 'mmf',
  debug: true
})

let amazonUsers = {
}

let mmfUsers = {
}

mmf.pre = (request, response, type) => {
  debug('pre ' + type)
  return getAmazonUserProfile(request.context.System.user.accessToken).then(amazonUser => {
    amazonUsers[request.context.System.user.accessToken] = amazonUser
    return getMMFUserProfile(amazonUser.email).then(mmfUser => {
      mmfUsers[amazonUser.email] = mmfUser
    })
  }).catch(error => {
    debug('pre error', error)
    amazonUsers[request.context.System.user.accessToken] = {}
  })
}

mmf.launch((request, response) => {
  debug(JSON.stringify(request, null, 2))
  const title = 'Hello ' + amazonUsers[request.context.System.user.accessToken].name + '. It\'s MMF assistant here. \n'
  const msg = 'I can help quickly create an appointment on the store calendar, or show you the store sales status. '
  response
  .say(title + msg)
  .card(title, msg)
  .shouldEndSession(false)
})

mmf.intent('AMAZON.HelpIntent', undefined, (request, response) => {
  let msg = 'you can ask - "create an appointment on Friday at 3PM" to add a booking to store calendar, or say - "show yesterday\'s sales" to review store performance. '
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

/**
 * AppointmentIntent with schema
 */
mmf.intent('AppointmentIntent', {
  dialog: {
    type: 'delegate'
  },
  slots: {
    // SERVICE: 'SERVICE',
    CUSTOMER: 'AMAZON.US_FIRST_NAME',
    DATE: 'AMAZON.DATE',
    TIME: 'AMAZON.TIME'
  },
  utterances: [
    '{make|create|add|save|book} {an appointment|a reservation} {|for} {-|CUSTOMER} {|on|by|for|as} {-|DATE} {|at} {-|TIME}',
    '{make|create|add|save|book} {an appointment|a reservation} {|for} {-|CUSTOMER} {|at} {-|TIME} {|on|by|for|as} {-|DATE}',
    '{make|create|add|save|book} {an appointment|a reservation} {|on|by|for|as} {-|DATE} {|at} {-|TIME} {|for} {-|CUSTOMER}',
    '{make|create|add|save|book} {an appointment|a reservation} {|on|by|for|as} {-|DATE} {|for} {-|CUSTOMER} {|at} {-|TIME}',
    '{make|create|add|save|book} {an appointment|a reservation} {|at} {-|TIME} {|on|by|for|as} {-|DATE} {|for} {-|CUSTOMER}',
    '{make|create|add|save|book} {an appointment|a reservation} {|at} {-|TIME} {|for} {-|CUSTOMER} {|on|by|for|as} {-|DATE}',
    '{make|create|add|save|book} {an appointment|a reservation} {|for} {-|CUSTOMER} {|at} {-|TIME}',
    '{make|create|add|save|book} {an appointment|a reservation} {|for} {-|CUSTOMER} {|on|by|for|as} {-|DATE}',
    '{make|create|add|save|book} {an appointment|a reservation} {|on|by|for|as} {-|DATE} {|at} {-|TIME}',
    '{make|create|add|save|book} {an appointment|a reservation} {|on|by|for|as} {-|DATE} {|for} {-|CUSTOMER} ',
    '{make|create|add|save|book} {an appointment|a reservation} {|at} {-|TIME} {|on|by|for|as} {-|DATE}',
    '{make|create|add|save|book} {an appointment|a reservation} {|at} {-|TIME} {|for} {-|CUSTOMER}',
    '{make|create|add|save|book} {an appointment|a reservation} {|for} {-|CUSTOMER}',
    '{make|create|add|save|book} {an appointment|a reservation} {|on|by|for|as} {-|DATE}',
    '{make|create|add|save|book} {an appointment|a reservation} {|at} {-|TIME}',
    '{make|create|add|save|book} {an appointment|a reservation}'
  ]
}, (request, response) => {
  debug('appointment intent', request.getDialog().dialogState, request.slots)
  response
  .say('the reservation is made! ' + request.slot('DATE') + ', ' + request.slot('TIME') + ', for ' + request.slot('CUSTOMER'))
  .shouldEndSession(true)
})

/**
 * SalesIntent with schema
 */
mmf.intent('SalesIntent', {
  slots: {
    DATE: 'AMAZON.DATE'
  },
  utterances: [
    '{show|tell|give|provide} {|me|us|store} {-|DATE} {performance|sales|status}',
    '{show|tell|give|provide} {|me|us|store} {performance|sales|status} {|of|for|as|on} {-|DATE}',
    '{what|how} is {|my|our|store} {-|DATE} {performance|sales|status}',
    '{what|how} is {|my|our|store} {performance|sales|status} {|of|for|as|on} {-|DATE}'
  ]
}, (request, response) => {
  debug('sales intent ', request.getDialog().dialogState, request.slots)
  let date = new Date()
  if (request.slot('DATE')) {
    date = new Date(request.slot('DATE'))
    if (date && date.getTime() > new Date().getTime()) {
      response
      .say('emm... we can\'t predict the future yet. do you mind trying today or a day in the past?')
      .shouldEndSession(true)
      return
    }
  }
  response
  .say('store sales ' + (request.slot('DATE') || 'today') + ' is as follows:')
  .say('products sold is ' + sales.products.quantity + ', gross is $' + sales.products.gross_total + '. \n')
  .say('services sold is ' + sales.services.quantity + ', gross is $' + sales.services.gross_total + '. \n')
  .say('total sales quality is ' + sales.total.quantity + ', total gross is $' + sales.total.gross_total + '. \n')
  .shouldEndSession(true)
})

/**
 * generate alexa skill schema
 */
app.get('/schemas', (req, res) => {
  res.send(mmf.schemas.skillBuilder())
})

app.get('/feed', (req, res) => {
  let date = new Date()
  res.send({
    'uid': 'urn:uuid:' + uuidv4(),
    'updateDate': date.toISOString(),
    'titleText': 'MMF fact at ' + date.getHours() + ' ' + date.getMinutes(),
    'mainText': facts[Math.floor(Math.random() * facts.length)],
    // 'streamUrl': 'https://developer.amazon.com/public/community/blog/myaudiofile.mp3',
    'redirectionUrl': 'https://developer.amazon.com/public/community/blog'
  })
})

/**
 * sanity
 */
app.get('/test', (req, res) => {
  res.send(new Date().toISOString())
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

const services = [
  {
    'store_service_id': 2,
    'store_id': 32746,
    'business_category_id': 14,
    'service_category_id': 6,
    'store_service_name': 'test2',
    'store_service_description': '',
    'price_type_id': 1,
    'regular_price': '1.00',
    'lowest_price': '1.00',
    'regular_duration': 5,
    'tax_id': 4,
    'has_processing_time': 1,
    'enable_online_booking': 1,
    'enable_voucher_sale': 1,
    'voucher_expiry_period_months': 1,
    'sort_order': 1,
    'create_staff_id': 32746,
    'created_at': 1506335086,
    'last_update_staff_id': 32746,
    'last_updated_at': 1506335561,
    'dr_status': 1
  },
  {
    'store_service_id': 1,
    'store_id': 32746,
    'business_category_id': 14,
    'service_category_id': 6,
    'store_service_name': 'test1',
    'store_service_description': '',
    'price_type_id': 1,
    'regular_price': '1.00',
    'lowest_price': '1.00',
    'regular_duration': 5,
    'tax_id': 4,
    'has_processing_time': 1,
    'enable_online_booking': 1,
    'enable_voucher_sale': 1,
    'voucher_expiry_period_months': 1,
    'sort_order': 0,
    'create_staff_id': 32746,
    'created_at': 1506334978,
    'last_update_staff_id': 32746,
    'last_updated_at': 1506335561,
    'dr_status': 1
  }
]

const sales = {
  'services': {
    'quantity': 2,
    'gross_total': 80
  },
  'products': {
    'quantity': 1,
    'gross_total': 9
  },
  'vouchers': {
    'quantity': 0,
    'gross_total': 0
  },
  'total': {
    'quantity': 3,
    'gross_total': 89
  }
}

function getAmazonUserProfile (accessToken) {
  return new Promise((resolve, reject) => {
    debug('get amazon user profile', accessToken)
    if (!accessToken) {
      resolve({})
    } else {
      let options = {
        url: 'https://api.amazon.com/user/profile?access_token=' + accessToken,
        json: true
      }
      request.get(options, (err, response, body) => {
        if (err) {
          debug(err)
          reject(err)
        } else if (response.statusCode !== 200) {
          debug(response.statusCode, response.statusMessage)
          reject(response.statusCode)
        } else {
          debug(body)
          resolve(body)
        }
      })
    }
  })
}

function getMMFUserProfile (email) {
  return new Promise((resolve, reject) => {
    debug('get mmf user profile', email)
    const uri = '/ms/store/view'
    if (!email) {
      resolve({})
    } else {
      let options = {
        url: process.env.MMF_URL + uri + '?email_address=' + email,
        headers: {
          'X-MMF-App-Key': process.env.MMF_KEY,
          'X-MMF-Request-Sign': apiSignature(uri)
        },
        json: true
      }
      request.get(options, (err, response, body) => {
        if (err) {
          debug(err)
          reject(err)
        } else if (response.statusCode !== 200) {
          debug(response.statusCode, response.statusMessage)
          reject(response.statusCode)
        } else {
          debug(body)
          resolve(body)
        }
      })
    }
  })
}

function apiSignature (uri) {
  let currentTime = Math.floor(Date.now() / 1000)
  let fullUrl = `${uri}${currentTime}`
  let sha1 = crypto.HmacSHA1(fullUrl, process.env.MMF_SECRET).toString().toLocaleUpperCase()
  return sha1 + ',' + currentTime
}
