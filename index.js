require('dotenv').config()

const alexa = require('alexa-app')
const mmf = new alexa.app('mmf')
const request = require('request')
const crypto = require('crypto-js')
const Fuse = require('fuse.js')
const AmazonSpeech = require('ssml-builder/amazon_speech')

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
  if (amazonUsers[request.context.System.user.accessToken]) {
    if (mmfUsers[amazonUsers[request.context.System.user.accessToken].email]) {
      return Promise.resolve()
    } else {
      return getMMFUserProfile(amazonUsers[request.context.System.user.accessToken].email).then(mmfUser => {
        mmfUsers[amazonUsers[request.context.System.user.accessToken].email] = mmfUser
      })
    }
  } else {
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
}

mmf.launch((request, response) => {
  const title = 'Hello ' + amazonUsers[request.context.System.user.accessToken].name + '. It\'s MMF assistant here. \n'
  const msg = 'I can help quickly create an appointment on the store calendar, or show you the store sales status. '
  response
  .say(title + msg)
  .card(title, msg)
  .shouldEndSession(false)
})

mmf.intent('AMAZON.HelpIntent', undefined, (request, response) => {
  let msg = 'you can say "create an appointment tomorrow at 3PM for Mary" to add a reservation to store calendar, or "show yesterday\'s sales" to review store performance. '
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

mmf.customSlot('SERVICE', [{
  value: 'AMAZON.LITERAL'
}])

/**
 * AppointmentIntent with schema
 */
mmf.intent('AppointmentIntent', {
  dialog: {
    type: 'delegate'
  },
  slots: {
    SERVICE: 'SERVICE',
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
  debug('user ', mmfUsers[amazonUsers[request.context.System.user.accessToken].email])
  // search matched service
  let pattern = request.slot('SERVICE')
  return getServices(mmfUsers[amazonUsers[request.context.System.user.accessToken].email].store.store_id).then(services => {
    let options = {
      shouldSort: true,
      threshold: 0.3,
      location: 0,
      distance: 100,
      maxPatternLength: 32,
      minMatchCharLength: 2,
      keys: [
        'store_service_name'
      ]
    }
    let matched = []
    services.forEach(category => {
      let fuse = new Fuse(category.services, options)
      fuse.search(pattern).forEach(service => {
        matched.push(service)
      })
    })
    // add appointment
    let customer = request.slot('CUSTOMER')
    let date = request.slot('DATE')
    let time = request.slot('TIME')
    let phone = '1234567890'
    let appointment = {
      first_name: customer,
      last_name: undefined,
      email_address: undefined,
      phone_number: phone,
      appointment_date: date,
      services: [{
        appointment_start_time: date + ' ' + time,
        appointment_duration: matched[0].regular_duration,
        service_category_id: matched[0].service_category_id,
        store_service_id: matched[0].store_service_id,
        store_service_name: matched[0].store_service_name,
        staff_id: matched[0].staff[0].staff_id
      }],
      store_id: matched[0].store_id
    }
    return addAppointment(appointment).then(result => {
      debug(result)
      let speech = new AmazonSpeech()
      .say('The appointment is made on ' + date + ', ' + time + ', for ' + customer + ' with phone number ')
      .sayAs({
        word: phone,
        interpret: 'telephone'
      })
      .say('.\n The appointment number is ')
      .sayAs({
        word: result.appointment_id,
        interpret: 'digits'
      })
      .say('. \n')
      // return response
      response
      .say(speech.ssml())
      .shouldEndSession(true)
    })
  })
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
      .say('well... we are not quite confident at predicting the future yet. do you mind trying today or a day in the past?')
      .shouldEndSession(true)
      return
    }
  }
  response
  .say('store sales ' + (request.slot('DATE') || 'today') + ' is as follows:')
  .say('products sold is ' + sales.products.quantity + ', gross is $' + sales.products.gross_total + '. \n')
  .say('services sold is ' + sales.services.quantity + ', gross is $' + sales.services.gross_total + '. \n')
  .say('total sales quantity is ' + sales.total.quantity + ', total gross is $' + sales.total.gross_total + '. \n')
  .shouldEndSession(true)
})

/**
 * generate alexa skill schema
 */
app.get('/schemas', (req, res) => {
  res.send(mmf.schemas.skillBuilder())
})

/**
 * sanity
 */
app.get('/user', (req, res) => {
  getMMFUserProfile('alamusi@efemme.com').then(data => {
    // res.send(user)
    debug(data)
    getServices(data.store.store_id).then(services => {
      let pattern = 'haircut'
      let options = {
        shouldSort: true,
        threshold: 0.3,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 2,
        keys: [
          'store_service_name'
        ]
      }
      let result = []
      services.forEach(category => {
        let fuse = new Fuse(category.services, options)
        fuse.search(pattern).forEach(service => {
          result.push(service)
        })
      })
      debug(result)
      addAppointment({
        first_name: 'Davis',
        last_name: undefined,
        email_address: undefined,
        phone_number: '12345678900',
        appointment_date: '2018-01-13',
        services: [{
          appointment_start_time: '2018-01-13 13:00',
          appointment_duration: 60,
          service_category_id: 1796,
          store_service_id: 4139,
          store_service_name: 'Men’s Haircut',
          staff_id: 32907
        }],
        store_id: 32863
      }).then(appointment => {
        let speech = new AmazonSpeech()
        .say('The appointment is made on ' + '2018-01-13' + ', ' + '13:00' + ', for ' + 'Tom' + ' with phone number ')
        .sayAs({
          word: '12345678900',
          interpret: 'telephone'
        })
        .pause('500ms')
        .say('The appointment number is ')
        .sayAs({
          word: appointment.appointment_id,
          interpret: 'digits'
        })
        debug(speech.ssml())
        res.send(speech.ssml())
      })
    }).catch(error => {
      res.send(error)
    })
  }).catch(error => {
    res.send(error)
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
          resolve(body.data)
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

function getServices (store) {
  return new Promise((resolve, reject) => {
    let uri = '/ms/service/get'
    let options = {
      url: process.env.MMF_URL + uri,
      headers: {
        'X-MMF-App-Key': process.env.MMF_KEY,
        'X-MMF-Request-Sign': apiSignature(uri)
      },
      qs: {
        store_id: store
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
        resolve(body.data.list)
      }
    })
  })
}

function addAppointment (appointment) {
  return new Promise((resolve, reject) => {
    let uri = '/ms/appointment/add'
    let options = {
      url: process.env.MMF_URL + uri,
      headers: {
        'X-MMF-App-Key': process.env.MMF_KEY,
        'X-MMF-Request-Sign': apiSignature(uri)
      },
      body: appointment,
      json: true
    }
    debug(JSON.stringify(options, null, 2))
    request.post(options, (err, response, body) => {
      if (err) {
        debug(err)
        reject(err)
      } else if (response.statusCode !== 200) {
        debug(response.statusCode, response.statusMessage)
        reject(response.statusCode)
      } else {
        debug(body)
        resolve(body.data)
      }
    })
  })
}
