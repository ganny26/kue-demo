// const kue = require('kue')
const express = require('express')
var kue = require('kue-unique')
//var queue = kue.createQueue()

const app = express()
const bodyParser = require('body-parser')
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())
const axios = require('axios')
const queue = kue.createQueue({
  prefix: 'q',
  redis: {
    port: 15545,
    host: 'redis-15545.c13.us-east-1-3.ec2.cloud.redislabs.com',
    auth: 'nrO2B94OMB83rzf84eQQwsp8NJce9XVm'
  }
})

app.use('/kue-ui', kue.app)

queue.on('ready', () => {
  console.log('queue is ready')
})

app.get(
  '/random/:account_id',
  async (req, res, next) => {
    let response = await axios.get('https://randomuser.me/api/')
    let result = response.data.results[0]
    let data = {
      email: result.email,
      user: `${result.name.first} ${result.name.last}`,
      account_id: req.params.account_id
    }

    req.data = data

    next()
  },
  function(req, res) {
    console.log('data', req.data)
    let job = queue
      .create('user_queue', {
        title: `Created a new job for user ${req.data.user}`,
        data: req.data
      })
      .unique(req.data.account_id)
      .save(err => {
        if (err) {
          console.error(`Job ID failed to add in queue`)
        }
        if (!err) {
          console.log(`Job ID added to queue`)
        }
      })

    res.status(200).send({
      message: 'job queued',
      payload: req.data
    })
  }
)

// app.post('/create_user', (req, res) => {
//   console.log('create user')
//   let { email, user } = req.body
//   let job = queue
//     .create('user_queue', {
//       title: `Created a new job for user ${user}`
//     })
//     .save(function(err) {
//       if (!err) {
//         console.log('job failed')
//       }
//       // Perform Your job operation here
//       console.log(job.id)
//     })

//   res.send(200)
// })

queue.process('user_queue', (job, done) => {
  //perform the operation from queue
  console.log('Processing Job from queue', job.data)

  done()
})

kue.Job.rangeByState('complete', 0, 100, 'asc', function(err, jobs) {
  console.log('removing all completed jobs before start')
  jobs.forEach(function(job) {
    job.remove(function() {
      console.log('removed ', job.id)
    })
  })
})

queue.on('error', err => {
  console.error('There was an error in the main queue!')
})

app.listen(3000, () => {
  console.log('server started')
})
