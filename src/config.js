export default {
  lowestBalance: 0.4,
  highestBalance: 0.6,
  offsetBalance: 0.01,
  offsetPricePercent: 0.03,
  targetMarket: 'BTC/USD',
  currency: 'BTC',
};

/*
default rule explain:
currency balance should change between 0.4 to 0.6 (40% - 60%) -"lowestBalance", "highestBalance"
whenever price change 3% - "offsetPricePercent"
we change the currecny balance 1% - "offsetBalance"
depends on price rise or drop, we sell or buy currency (buy low sell high)
'BTC/USD' is the pair we use to sell/buy currency - "targetMarket"
*/