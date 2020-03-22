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
    const line = lrs.readline();
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
    rawCert: readTlsCert("/root/.lnd_ltc/tls.cert"),
  },
  {
    currency: "XSN",
    lndChannel: "localhost:10003",
    rawCert: readTlsCert("/root/.lnd_xsn/tls.cert"),
  }
];

const SampleOrder = {
  pairId: "XSN_LTC",
  side: 1,
  funds: {value: "10000"},
  price: {value: "100000"}
};

const getClient = function (Client) {
  return new Client(RpcAddress, grpc.credentials.createInsecure());
};

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

async function isOrderExist(ordersLssd, newOrder) {
  if (!newOrder.orderId) return false;
  const listOrderReq = {
    pairId: "XSN_LTC",
    includeOwnOrders: false,
    skip: 0,
    limit: 100,
  };
  while (1) {
    let orders = [];
    let isOk = true;
    await new Promise((resolve, reject) => {
      ordersLssd.ListOrders( listOrderReq, function(err, res) {
        if (isEmpty(res)) return resolve();

        if (err || !res.orders || !res.orders.length || !res.orders[0].orderId) {
          isOk = false;
        }
        else {
          orders = res.orders;
        }
        return resolve();
      });
    });

    if (!isOk) return false;

    for (let i = 0 ; i < orders.length ; i ++) {
      if (orders[i].orderId == newOrder.orderId) {
        return orders[i];
      }
    } 

    if (orders.length < listOrderReq.limit) break;
    listOrderReq.skip += listOrderReq.limit;
  }

  return false;
}

async function testAddCurrency(currenciesLssd) {
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

async function testEnableTradingPair(tradingPairLssd) {
  await new Promise((resolve, reject) => {
    tradingPairLssd.EnableTradingPair( {
      pairId: "XSN_LTC"
    }, function(err, res) {
      if (err) {
        testResult("EnableTradingPair(XSN_LTC)", 0);
        return reject();
      }
      testResult("EnableTradingPair(XSN_LTC)", 1);
      return resolve();
    });
  })
}

async function testPlaceAndCancelOrder(ordersLssd) {
  const newOrder = SampleOrder;
  await new Promise((resolve, reject) => {
    ordersLssd.PlaceOrder( newOrder, function(err, res) {
      if (err || !res.order) {
        testResult("PlaceOrder", 0, err ? err : res);
        return reject();
      }
      const order = res.order;
      if (newOrder.pairId === order.pairId && newOrder.side === order.side && 
          newOrder.price.value === order.price.value && 
          newOrder.funds.value === order.funds.value) {
        newOrder.orderId = order.orderId;
        testResult("PlaceOrder", 1);
        return resolve();
      }
      else {
        testResult("PlaceOrder", 0, res);
        return reject();
      }
    });
  });

  if (await isOrderExist(ordersLssd, newOrder) !== false) {
    testResult("ListOrders", 1);
  }
  else {
    testResult("ListOrders", 0, 'new order not found');
  }

  await new Promise((resolve, reject) => {
    ordersLssd.CancelOrder( {
      pairId: newOrder.pairId,
      orderId: newOrder.orderId
    }, function(err, res) {
      return resolve();
    });
  });

  if (await isOrderExist(ordersLssd, newOrder) === false) {
    testResult("CancelOrder", 1);
  }
  else {
    testResult("CancelOrder", 0, 'new order not cancelled');
  }
}

async function testSubscribers(ordersLssd, swapsLssd) {
  // Orders -> PlaceOrder
  let newOrder = SampleOrder;
  new Promise((resolve, reject) => {
    ordersLssd.PlaceOrder( newOrder, function(err, res) {
      if (err || !res.order) {
        testResult("PlaceOrder", 0, err ? err : res);
        return reject();
      }
      const order = res.order;
      if (newOrder.pairId === order.pairId && newOrder.side === order.side && 
          newOrder.price.value === order.price.value && 
          newOrder.funds.value === order.funds.value) {
        newOrder = order;
        testResult("PlaceOrder", 1);
        return resolve();
      }
      else {
        testResult("PlaceOrder", 0, res);
        return reject();
      }
    });
  });
  console.log("\x1b[32mPlease wait for SubscribeOrders and SubscribeSwaps\x1b[0m");
  // Orders->SubscribeOrders
  new Promise((resolve, reject) => {
    const orderUpdateStream = ordersLssd.SubscribeOrders({});
    orderUpdateStream.on('data', data => {
      console.log('order-data', data);
      orderUpdateStream.destroy();
    });
    orderUpdateStream.on('error', err => {
      testResult("SubscribeOrders", 0, err);
      reject();
    });
    orderUpdateStream.on('close', () => {
      testResult("SubscribeOrders", 1);
      resolve();
    });
  });

  // Swap->SubscribeSwaps
  new Promise((resolve, reject) => {
    const SwapResultStream = swapsLssd.SubscribeSwaps({});
    SwapResultStream.on('data', data => {
      if(data.success || data.failure) {
        testResult("SubscribeSwaps", 1);
      }
      else {
        testResult("SubscribeSwaps", 0, data);
      }
      console.log(data);
      SwapResultStream.destroy();
    });
    SwapResultStream.on('error', err => {
      testResult("SubscribeSwaps", 0, err);
      reject();
    });
    SwapResultStream.on('close', () => {
      resolve();
    });
  });
}
async function bot() {
  const currenciesLssd = getClient(currenciesClient);
  const tradingPairLssd = getClient(tradingPairsClient);
  const ordersLssd = getClient(ordersClient);
  const swapsLssd = getClient(swapsClient);
  await testAddCurrency(currenciesLssd);
  await testEnableTradingPair(tradingPairLssd);
  await testPlaceAndCancelOrder(ordersLssd);
  await testSubscribers(ordersLssd, swapsLssd);
}

bot();
