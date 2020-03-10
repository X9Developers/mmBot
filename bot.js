const path = require('path');
const grpc = require('grpc');
const lineReaderSync = require('line-reader-sync');
const protoLoader = require('@grpc/proto-loader');
const packageDefinition = protoLoader.loadSync('lssdrpc.proto');
const lssdrpc = grpc.loadPackageDefinition(packageDefinition).lssdrpc;
const currenciesClient = lssdrpc.currencies;
const tradingPairsClient = lssdrpc.tradingPairs;
const ordersClient = lssdrpc.orders;
const swapsClient = lssdrpc.swaps;

const RpcConfig = {
  host: "localhost",
  port: 50051
}
const RpcAddress = RpcConfig.host + ":" + RpcConfig.port;

function readTlsCert(path) {
  let cert = "";
  lrs = new lineReaderSync(path);
  while(true){
    var line = lrs.readline();
    if (line === null) {
      break;
    }
    if (cert) cert += "\n";
    cert += line;
  }
  return cert;
}
const currencies = [
  {
    currency: "LTC",
    lndChannel: "localhost:10001",
    tlsCert: {
      certPath: "/root/.lnd_ltc/tls.cert",
      rawCert: readTlsCert("/root/.lnd_ltc/tls.cert"),
    },
  },
  {
    currency: "XSN",
    lndChannel: "localhost:10003",
    tlsCert: {
      certPath: "/root/.lnd_xsn/tls.cert",
      rawCert: readTlsCert("/root/.lnd_xsn/tls.cert"),
    },
  }
];

const getClient = function (Client) {
  return new Client(RpcAddress, grpc.credentials.createInsecure());
};

const testResult = function(text, result) {
  if (result) {
    console.log(text + ": \x1b[32mpassed\x1b[0m");
  }
  else {
    console.log(text + ": \x1b[31mnot passed\x1b[0m");
  }
}

async function bot() {

  const currenciesLssd = getClient(currenciesClient);
  const tradingPairLssd = getClient(tradingPairsClient);
  const ordersLssd = getClient(ordersClient);
  const swapsLssd = getClient(swapsClient);

  // Add Currency
  await Promise.all(currencies.map( async item => {
    return new Promise((resolve, reject) => {
      currenciesLssd.AddCurrency({
        currency: item.currency,
        lndChannel: item.lndChannel,
        tlsCert: item.tlsCert
      }, function(err, res) {
        if (err) {
          testResult("AddCurrency(" + item.currency + ")", 0);
          return resolve();
        }
        testResult("AddCurrency(" + item.currency + ")", 1);
        return resolve();
      });
    })
  }));
  // Trading Pair
  await new Promise((resolve, reject) => {
    tradingPairLssd.EnableTradingPair( {
      pairId: "XSN_LTC"
    }, function(err, res) {
      if (err) {
        testResult("EnableTradingPair(XSN_LTC)", 0);
        return resolve();
      }
      testResult("EnableTradingPair(XSN_LTC)", 1);
      return resolve();
    });
  })

  // Orders->PlaceOrder
  await new Promise((resolve, reject) => {
    ordersLssd.PlaceOrder( {
      pairId: "XSN_LTC",
      side: 1,
      funds: {value: "100"},
      price: {value: "100"},
    }, function(err, res) {
      if (err) {
        testResult("PlaceOrder(XSN_LTC)", 0);
        return resolve();
      }
      testResult("PlaceOrder(XSN_LTC)", 1);
      return resolve();
    });
  });
  // Orders->ListOrder
  await new Promise((resolve, reject) => {
    ordersLssd.ListOrders( {
      pairId: "XSN_LTC",
      includeOwnOrders: false,
      skip: 0,
      limit: 2,
    }, function(err, res) {
      if (err) {
        testResult("ListOrders(XSN_LTC)", 0);
        return resolve();
      }
      testResult("ListOrders(XSN_LTC)", 1);
      return resolve();
    });
  });
}

bot();
