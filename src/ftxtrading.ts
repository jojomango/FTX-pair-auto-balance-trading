import axios from 'axios'
import BN from 'bignumber.js'
import crypto from 'crypto'
import config from './config';

type SecretInfo = {
  ftxAccountBTC: string;
  ftxAPIKeyBTC: string;
  ftxSecretBTC: string;
}

type HandlerEvent = {
  secrets: SecretInfo;
}

const {
  lowestBalance,
  highestBalance,
  offsetBalance,
  offsetPricePercent,
  targetMarket,
  currency,
} = config;



export async function handler(event: HandlerEvent) {
  const { secrets } = event;
  const { ftxAccountBTC: ftxAccount, ftxAPIKeyBTC: ftxAPIKey, ftxSecretBTC: ftxSecret } = secrets

  if (!ftxAccount || !ftxAPIKey || !ftxSecret) {
    console.warn('Should set secrect properly')
    return
  }
  const ZERO = new BN(0)
  const API_ENDPOINT = 'https://ftx.com'
  const sha256Hmac = (data: string) : string => {
    const hmac = crypto.createHmac('sha256', ftxSecret)
    hmac.update(data)
    return hmac.digest('hex')
  }

  const sendRequest = async (method: string, path: string, headers: Record<string,any> = {}, data: any = undefined) : Promise<Record<string,any>> => {
    const url = `${API_ENDPOINT}${path}`
    const timestamp = (new Date()).getTime().toString()
    let auth = timestamp + method + path
    let request: Record<string,any> = {
      url,
      method
    }
    headers['User-Agent'] = 'ftx-lending-bot/0.1'
    if (method == 'POST') {
      let body = JSON.stringify(data)
      auth += body
      headers['Content-Type'] = 'application/json'
      request.data = body
    }
    const signature = sha256Hmac(auth)
    headers['FTX-KEY'] = ftxAPIKey
    headers['FTX-TS'] = timestamp
    headers['FTX-SIGN'] = signature
    headers['FTX-SUBACCOUNT'] = ftxAccount
    request.headers = headers
    return await axios.request(request)
  }

  const getWalletBalance = async () : Promise<Record<string,any>> => {
    const path = '/api/wallet/balances'
    const method = 'GET'
    let result = {
      info: {}
    }
    const res = await sendRequest(method, path)
    if (res.status == 200) {
      result.info = res.data
      return result
    }
    throw new Error('failed to get wallet balances')
  }

  const getSingleMarket = async (market: string) : Promise<Record<string,any>> => {
    const path = `/api/markets/${market}`
    const method = 'GET'
    let result = {
      info: {}
    }
    const res = await sendRequest(method, path)
    if (res.status == 200) {
      result.info = res.data
      return result
    }
    throw new Error(`failed to get {market} market status`)
  }

  const getOrderHistory = async (market: string) : Promise<Record<string,any>> => {
    const path = `/api/orders/history?market=${market}`
    const method = 'GET'
    let result = {
      info: {}
    }
    const res = await sendRequest(method, path)
    if (res.status == 200) {
      result.info = res.data
      return result
    }
    throw new Error(`failed to get {market} order history`)
  }

  const cancelAllOrders = async (market: string) : Promise<Record<string,any>> => {
    const path = '/api/orders'
    const method = 'DELETE'
    const res = await sendRequest(method, path, {}, { market: market })
    if (res.status == 200) {
      return res.data
    }
    throw new Error('failed to post spot margin offers')
  }

  const placeOrder = async (data: Record<string,any>) : Promise<Record<string,any>> => {
    const path = '/api/orders'
    const method = 'POST'
    const res = await sendRequest(method, path, {}, data)
    if (res.status == 200) {
      return res.data
    }
    throw new Error('failed to post spot margin offers')
  }

  const cancelOrder_res = await cancelAllOrders(targetMarket);
  if (cancelOrder_res && cancelOrder_res.success) {
    console.log('cancle order success:', cancelOrder_res.result);
  } else {
    console.log('cancel fail', cancelOrder_res);
  }

  let currency_balance;
  let currency_amt;

  const balance_res = await getWalletBalance()
  if (balance_res.info && balance_res.info.success) {
    const balances = balance_res.info.result.filter((r: Record<string, any>) => {
      return (new BN(r.total)).gt(ZERO)
    });
    const sumValue = balances.reduce((acc: number, current: Record<string, any>) => acc + current.usdValue,0) as number;
    const currencyObj = balances.find((r: Record<string, any>) => r.coin === currency);
    const currencyValue = currencyObj?.usdValue || 0 as number;
    currency_balance = parseFloat((currencyValue /sumValue).toFixed(4));
    currency_amt = currencyObj?.total;
    console.log('currency:', { currency, currency_balance, currency_amt });
  } else {
    throw new Error('get balance fail');
  }

  let topPrice;
  let bottomPrice;
  let lastPrice;

  const orders_res = await getOrderHistory(targetMarket);

  if (orders_res.info && orders_res.info.success) {
    const lastOrder = orders_res.info.result.find((r:Record<string, any> )=> r.filledSize > 0);
    if (lastOrder) {
      topPrice = lastOrder.price * (1 + offsetPricePercent);
      bottomPrice = lastOrder.price * (1 - offsetPricePercent);
      lastPrice = lastOrder.price;
    } 
    // else {
    //   /*uncomment if your sub-account has no trade ever */  
    //   topPrice = '<manual-set-topPrice>';
    //   bottomPrice = '<manual-set-bottom-Price>';
    // }
    console.log('prices:', { topPrice, bottomPrice, lastPrice });
  } else {
    throw new Error('get order history fail');
  }

  let currentPrice;
  let bestAsk;
  let bestBid;
  let minSize;

  const market_res = await getSingleMarket(targetMarket);

  if (market_res.info && market_res.info.success) {
    const marketObj = market_res.info.result;
    currentPrice = marketObj.last;
    bestAsk = marketObj.ask;
    bestBid= marketObj.bid;
    minSize = marketObj.minProvideSize;
    console.log('market status:', { currentPrice, bestAsk, bestBid, minSize });
  } else {
    throw new Error('get market fail');
  }

  if (currentPrice >= topPrice) {
    // sell
    const targetBalance = currency_balance - offsetBalance;
    let tradeBalance;
    if (targetBalance >= lowestBalance) {
      tradeBalance = offsetBalance
    } else {
      tradeBalance = currency_balance - lowestBalance;
    }
    const size = (tradeBalance / currency_balance) * currency_amt;
    if (size > minSize) {
      const order_res = await placeOrder(
        {
          "market": targetMarket,
          "side": "sell",
          "price": bestAsk,
          "type": "limit",
          "size": size,
          "reduceOnly": false,
          "ioc": false,
          "postOnly": true,
          "clientId": null
        }
      )
      if (order_res && order_res.success) {
        console.log('place sell order success', order_res.result);
      } else {
        console.log('place sell order fail', order_res);
      }
      console.log('sell', { size });
    }
    
  } else if (currentPrice <= bottomPrice) {
    // buy
    const targetBalance = currency_balance + offsetBalance;
    let tradeBalance;
    if (targetBalance <= highestBalance) {
      tradeBalance = offsetBalance
    } else {
      tradeBalance = highestBalance - currency_balance;
    }
    const size = (tradeBalance / currency_balance) * currency_amt;
    if (size > minSize) {
      const order_res = await placeOrder(
        {
          "market": targetMarket,
          "side": "buy",
          "price": bestBid,
          "type": "limit",
          "size": size,
          "reduceOnly": false,
          "ioc": false,
          "postOnly": true,
          "clientId": null
        }
      )
      if (order_res && order_res.success) {
        console.log('place buy order success', order_res.result);
      } else {
        console.log('place buy order fail', order_res);
      }
      console.log('buy', { size });
    }
    
  }
}

// To run locally (this code will not be executed in Autotasks)
if (require.main === module) {
  require('dotenv').config();
  const { ftxAccountBTC, ftxAPIKeyBTC, ftxSecretBTC } = process.env as SecretInfo
  handler({ secrets: { ftxAccountBTC, ftxAPIKeyBTC, ftxSecretBTC } })
    .then(() => process.exit(0))
    .catch((error: Error) => { console.error(error); process.exit(1); });
}
