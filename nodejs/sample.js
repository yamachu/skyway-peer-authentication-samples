'use strict';

const express = require('express');
const bodyParser = require('body-parser');

const hmac = require('crypto-js/hmac-sha256');
const CryptoJS = require('crypto-js');

require('dotenv').config();

const uuid = require('uuid').v4;
const firebaseAdmin = require('firebase-admin');

/************************************************
 *            Config section start              *
 *         replace with your own values         *
 ************************************************/

const secretKey = 'YourSecretKey'; // replace with your own secretKey from the dashboard
const credentialTTL = 3600; // 1 hour

/************************************************
 *            Config section finished           *
 ************************************************/

const firebaseAdminApp = firebaseAdmin.initializeApp({
  credential: firebaseAdmin.credential.cert(process.env.FIREBASE_ADMIN_JSON),
});

const app = express();
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
app.use(function (req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE');
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, Authorization'
  );
  if ('OPTIONS' === req.method) {
    res.sendStatus(200);
  } else {
  next();
  }
});

app.use(function (req, res, next) {
  if (req.headers.authorization === undefined) {
    return res.status(403);
  }
  next();
});

app.post('/authenticate', (req, res) => {
  const peerId = req.body.peerId;
  const sessionToken = req.body.sessionToken;

  if(peerId === undefined || sessionToken === undefined) {
    res.status(400).send('Bad Request');
    return;
  }

  checkSessionToken(peerId, sessionToken).then(() => {
    // Session token check was successful.

    // We need the current unix timestamp. Date.now() returns in milliseconds so divide by 1000 to get seconds.
    const unixTimestamp = Math.floor(Date.now() / 1000);

    const credential = {
      peerId: peerId,
      timestamp: unixTimestamp,
      ttl: credentialTTL,
      authToken: calculateAuthToken(peerId, unixTimestamp)
    };

    res.send(credential);
  }).catch(() => {
    // Session token check failed
    res.status(401).send('Authentication Failed');
  });
});

app.post('/rooms', (req, res) => {
  const { targetUid: meetWith, mode: roomType } = req.body;
  const sessionToken = req.headers.authorization.replace(/^Bearer /, '');

  if (meetWith === undefined || roomType === undefined) {
    res.status(400).send('Bad Request');
    return;
  }

  firebaseAdminApp
    .auth()
    .verifyIdToken(sessionToken)
    .then((v) => {
      if (v.interviewer !== true) {
        throw res.status(403);
      }
      return v.uid;
    })
    .then((uid) =>
      firebaseAdminApp
        .auth()
        .getUser(meetWith)
        .then((v) => v.uid)
        .then((meetWith) => [uid, meetWith])
        .catch((_) => {
          throw res.status(400);
        })
    )
    .then(([uid, meetWith]) => {
      const createdAt = Date.now();
      const roomId = uuid().slice(0, 18);

      return Promise.all([
        firebaseAdminApp
          .firestore()
          .collection('chats')
          .doc(uid)
          .collection('rooms')
          .add({
            meetWith,
            roomId,
            roomType,
            createdAt,
          }),
        firebaseAdminApp
          .firestore()
          .collection('chats')
          .doc(meetWith)
          .collection('rooms')
          .add({
            meetWith: uid,
            roomId,
            roomType,
            createdAt,
          }),
      ]);
    })
    .then(() => res.status(201).send())
    .catch((r) => {
      if (r.send !== undefined) {
        r.send();
        return;
      }
      res.status(400).send();
    });
});

const listener = app.listen(process.env.PORT || 8080, () => {
  console.log(`Server listening on port ${listener.address().port}`)
});

function checkSessionToken(peerId, token) {
  return new Promise((resolve, reject) => {
    // Implement checking whether the session is valid or not.
    // Resolve if the session token is valid.
    // Reject if it is invalid.

    resolve();
  });
}

function calculateAuthToken(peerId, timestamp) {
  // calculate the auth token hash
  const hash = CryptoJS.HmacSHA256(`${timestamp}:${credentialTTL}:${peerId}`, secretKey);

  // convert the hash to a base64 string
  return CryptoJS.enc.Base64.stringify(hash);
}