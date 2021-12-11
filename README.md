# Openzeppelin Defender Scripts
This repository collect fun scripts that run on openzeppelin defender autotask

> Note: these scripts are experimental, use at your own risk.

### FTX trade automatically

the project logic is balance 2 currency(BTC, USD) when the price changed
use latest trade price as base, if the price rise 3%, then reduce the balance 1% to sell, vice verse.


```BASH
$ yarn build && yarn start
```

## Running Locally

You can run the scripts locally, instead of in an Autotask, and create a `.env` file in this folder with the following content:

```
ftxAccountBTC=<ftx-sub-account-name>
ftxAPIKeyBTC=<ftx-sub-account-api-key>
ftxSecretBTC=<ftx-sub-account-api-secret>
```

and make sure you create these 3 secrets on defender also, must has the same "name" and "value", and the name is case-sensitive.

## Upload code to defender autoTask

After `yarn build` finished, you could upload built code to defender autotask, before that add defender team API KEY/SECRET to `.env` file:

```
API_KEY=<defender-team-API-KEY>
API_SECRET=<defender-team-API-SECRET>
```
and setup "defender-autoTask-ID" in `package.json -> scripts -> upload` command,
the command should update as:

```
"upload": "defender-autotask update-code <defender-autoTask-ID> ./dist",
```

to override autoTask code in defender side by the command:

```BASH
$ yarn build && yarn upload
```

