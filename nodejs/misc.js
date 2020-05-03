const firebaseAdmin = require('firebase-admin');
require('dotenv').config();

/**
 * @param {firebaseAdmin.app.App} app
 * @param {string} email
 * @param {string} password
 */
const createUser = (app, email, password) =>
  app.auth().createUser({
    email,
    password,
  });

/**
 * @param {firebaseAdmin.app.App} app
 * @param {string} email
 */
const addInterviewerClaim = (app, email) =>
  app
    .auth()
    .getUserByEmail(email)
    .then((v) => v.uid)
    .then((uid) =>
      app.auth().setCustomUserClaims(uid, {
        interviewer: true,
      })
    );

/**
 * @param {string[]} args
 * @return {{ credentialPath: string, method: string, params: string[]}}
 */
const parseArgs = (args) => {
  const [, , method, ...params] = args;
  return {
    credentialPath: process.env.FIREBASE_ADMIN_JSON,
    method,
    params,
  };
};

/**
 * @param {string[]} args
 */
const main = async (args) => {
  const { credentialPath, method, params } = parseArgs(args);
  const credential = firebaseAdmin.credential.cert(credentialPath);
  const app = firebaseAdmin.initializeApp({ credential });

  switch (method) {
    case 'createUser': {
      const result = await createUser(app, ...params.slice(0, 2));
      console.dir(result);
      break;
    }
    case 'addClaim': {
      await addInterviewerClaim(app, ...params.splice(0, 1));
      break;
    }
    default: {
      console.warn(
        `
        |${args[0]} ${args[1]} <action> [args...]
        |action:
        |    createUser: create firebase user
        |        usage: createUser <email> <password>
        |    addClaim: add interviewer claim
        |        usage: addClaim <email>
        |`.replace(/^\s*\|/gm, '')
      );
    }
  }
};

main(process.argv).then(() => process.exit());
