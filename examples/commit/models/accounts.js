const mapEvents = require("jerni/lib/mapEvents");
const { Model } = require("@jerni/store-mongo");

module.exports = new Model({
  name: "accounts",
  version: "1.0.0",
  transform: mapEvents({
    ACCOUNT_OPENED: event => ({
      insertOne: {
        id: event.payload.id,
        full_name: event.payload.name,
        balance: 0
      }
    }),

    ACCOUNT_CLOSED: event => ({
      deleteOne: {
        where: {
          id: event.payload.id
        }
      }
    }),

    DEPOSITED: event => ({
      updateOne: {
        where: { id: event.payload.receiver },
        changes: {
          $inc: {
            balance: event.payload.amount
          }
        }
      }
    }),

    /*
      the next 3 handlers will demonstrate how 2-phase commit work with jerni
      in case of system failure before a transaction is either commit/revert,
      we will need to scan through all the accounts to see if there are any
      ongoing transactions in order to re-evaluate each of them.
    */
    TRANSACTION_MADE: event => ({
      updateOne: {
        // find the sender
        where: {
          id: event.payload.from,

          // but will skip if this transaction is somehow applied for the sender
          "outgoing_transactions.id": { $ne: event.payload.id }
        },
        changes: {
          // subtract the fund from sender's account
          $inc: {
            balance: -event.payload.amount
          },
          // append a transaction to outgoing_transactions
          // this is in case a system failure occurred before a transaction can commit/revert
          $push: {
            outgoing_transactions: event.payload
          }
        }
      }
      // note that we don't touch the receiver yet, they don't see any thing until the transaction is committed
    }),

    // when a transaction is reverted
    TRANSACTION_REVERTED: event => ({
      updateOne: {
        // we find the sender
        where: {
          id: event.payload.from,
          // but will skip if this transaction is somehow reverted for the sender
          "outgoing_transactions.id": event.payload.id
        },

        // and revert the changes (refund and remove the outgoing transaction)
        changes: {
          $inc: { balance: event.payload.amount },
          $pull: { outgoing_transactions: { id: event.payload.id } }
        }
      }
    }),

    // when a transcation is committed
    TRANSACTION_COMMITTED: event => [
      {
        updateOne: {
          // we find the receiver
          where: {
            id: event.payload.to
          },

          // to add the new fund to their account
          changes: {
            $inc: { balance: event.payload.amount }
          }
        }
      },
      {
        updateOne: {
          // we also look for the sender
          where: {
            id: event.payload.from
          },

          // and remove the transaction
          changes: {
            $pull: { outgoing_transactions: { id: event.payload.id } }
          }
        }
      }
    ]
  })
});
