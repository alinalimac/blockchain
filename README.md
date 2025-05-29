# HEALTHCHAIN 

This is a code of HealthChain project which is a prototype of a decenterilized system for storing medical data. We use **MegaTestETH** in this prototype. Etherium is a preferable cryptocurrency to use in a real project.

> [!IMPORTANT]
> All contracts were deployed in REMIX. Here we only have the Solidity code.

1. `server.js` is needed for accessing constants that are in `.env` file. For safety reasons, `.env` is not in this repository as it contains secret keys to IPFS storage.
2. To run `server.js` you need to install `node`, `express` & `cors` viz `npm install **` command in terminal. To run the server type `node server.js` in terminal.

> [!IMPORTANT]
> Sometimes you need to type `sudo npm...` as you need to access folder only a user with root rights can access.

> [!WARNING]
> DO NOT STORE IPFS **API KEY**, **API SECRET** & **JWT** INSIDE YOUR CODE THAT CAN BE ACCESSED BY OTHER PEOPLE.
