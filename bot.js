const dotenv = require('dotenv');
const grpc = require('grpc');
const lineReaderSync = require('line-reader-sync');
const protoLoader = require('@grpc/proto-loader');
const packageDefinition = protoLoader.loadSync('lssdrpc.proto');
const lssdrpc = grpc.loadPackageDefinition(packageDefinition).lssdrpc;
const currenciesClient = lssdrpc.currencies;
const tradingPairsClient = lssdrpc.tradingPairs;
const ordersClient = lssdrpc.orders;
const swapsClient = lssdrpc.swaps;

dotenv.config({
  path: './.env',
});
const env = process.env;
const max = 100000000;

const RpcConfig = {
  host: env['LSSD_HOST'],
  port: parseInt(env['LSSD_PORT'])
}
const RpcAddress = RpcConfig.host + ":" + RpcConfig.port;

const currencies = [
  {
    currency: "LTC",
    lndChannel: env['LTC_LND_CHANNEL'],
    rawCert: readTlsCert(env['LTC_CERT_PATH']),
  },
  {
    currency: "XSN",
    lndChannel: env['XSN_LND_CHANNEL'],
    rawCert: readTlsCert(env['XSN_CERT_PATH']),
  },
  {
    currency: "BTC",
    lndChannel: env['BTC_LND_CHANNEL'],
    rawCert: readTlsCert(env['BTC_CERT_PATH']),
  }
];

const PlaceOrderLimit = env['PLACE_ORDER_LIMIT'];

const getClient = function (Client) {
  return new Client(RpcAddress, grpc.credentials.createInsecure());
};

const currenciesLssd = getClient(currenciesClient);
const tradingPairLssd = getClient(tradingPairsClient);
const ordersLssd = getClient(ordersClient);
const swapsLssd = getClient(swapsClient);

function readTlsCert(path) {
  let cert = "";
  lrs = new lineReaderSync(path);
  while(true){
    const line = lrs.readline();
    if (line === null) {
      break;
    }
    if (cert) cert += "\n";
    cert += line;
  }
  return cert;
}

const testResult = function(text, result, msg) {
  if (result) {
    console.log(text + ": \x1b[32mpassed\x1b[0m");
  }
  else {
    console.log(text + ": \x1b[31mnot passed\x1b[0m");
    if (msg) console.log(msg);

    console.log("\x1b[31mPlase Try Again!\x1b[0m");
    process.exit();
  }
}

function isEmpty(obj) {
  for(const prop in obj) {
    if(obj.hasOwnProperty(prop)) {
      return false;
    }
  }
  return true;
}

async function getNewOrder(side) {
  if (side == 0) {
    return {
      pairId: env['PAIRID'],
      side: 0,
      funds: {value: ((Math.floor(Math.random() * max) % 13) + 13).toString()},
      price: {value: ((Math.floor(Math.random() * max) % 100000) + 100000).toString()},
    };
  }
  else {
    return {
      pairId: env['PAIRID'],
      side: 1,
      funds: {value: ((Math.floor(Math.random() * max) % 10000) + 10000).toString()}, // 10000 ~ 20000
      price: {value: ((Math.floor(Math.random() * max) % 100000) + 100000).toString()}, // 100000 ~ 200000
    };
  }

  /* Can Add Algo Here
  const newOrder = {
    pairId: env['PAIRID'],
    side: parseInt(env['ORDER_SIDE']),
    funds: {value: "10000"},
    price: {value: "100000"}
  };

  const listOrderReq = {
    pairId: env['PAIRID'],
    includeOwnOrders: false,
    skip: 0,
    limit: 100,
  };
  while (1) {
    let orders = [];
    await new Promise((resolve, reject) => {
      ordersLssd.ListOrders( listOrderReq, function(err, res) {
        if (!err && !isEmpty(res) && res.orders)
        {
          orders = res.orders;
        }
        return resolve();
      });
    });

    for (let i = 0 ; i < orders.length ; i ++) {
      if (!orders[i].side && orders[i].side != parseInt(env['ORDER_SIDE'])) {
        continue;
      }
      // And find Min and Max here
    } 

    if (orders.length < listOrderReq.limit) break;
    listOrderReq.skip += listOrderReq.limit;
  }
  return newOrder;
  */
}

async function AddCurrency() {
  await Promise.all(currencies.map( async item => {
    return new Promise((resolve, reject) => {
      currenciesLssd.AddCurrency(item, function(err, res) {
        if (err) {
          testResult("AddCurrency(" + item.currency + ")", 0);
          return reject();
        }
        testResult("AddCurrency(" + item.currency + ")", 1);
        return resolve();
      });
    })
  }));
}

async function EnableTradingPair() {
  await new Promise((resolve, reject) => {
    tradingPairLssd.EnableTradingPair( {
      pairId: env['PAIRID']
    }, function(err, res) {
      if (err) {
        testResult("EnableTradingPair", 0);
        return reject();
      }
      testResult("EnableTradingPair", 1);
      return resolve();
    });
  })
}

async function PlaceOrder(PlaceOrderLimit) {
  if (PlaceOrderLimit == 0) {
    console.log("\x1b[32mfinished!\x1b[0m");
    process.exit();
  }
  const newOrder = await getNewOrder(PlaceOrderLimit % 2);
  ordersLssd.PlaceOrder( newOrder, function(err, res) {
    if (err || res.failure) {
      testResult("PlaceOrder", 0, err ? err : res);
    }
    testResult("PlaceOrder", 1);
    return PlaceOrder(PlaceOrderLimit - 1);
  });
}

async function Subscribe() {
  const orderUpdateStream = ordersLssd.SubscribeOrders({});
  orderUpdateStream.on('data', data => {
    console.log('orders - ', data);
  });
  orderUpdateStream.on('error', err => {
    testResult("SubscribeOrders", 0, err);
  });
  orderUpdateStream.on('close', () => {
  });

  const SwapResultStream = swapsLssd.SubscribeSwaps({});
  SwapResultStream.on('data', data => {
    console.log('swaps - ', data);
  });
  SwapResultStream.on('error', err => {
    testResult("SubscribeSwaps", 0, err);
  });
  SwapResultStream.on('close', () => {
  });
}
async function bot() {

  await AddCurrency();
  await EnableTradingPair();
  PlaceOrder(PlaceOrderLimit);
  Subscribe();
}

bot();
