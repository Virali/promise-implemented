const STATE = {
  FULFILLED: "fulfilled",
  REJECTED: "rejected",
  PENDING: "pending",
};

class MyPromise {
  #thenCallbacks = [];
  #catchCallbacks = [];
  #state = STATE.PENDING;
  #value = undefined;
  #onFulfilledBound = this.#onFulfilled.bind(this);
  #onRejectedBound = this.#onRejected.bind(this);

  constructor(callback) {
    try {
      callback(this.#onFulfilledBound, this.#onRejectedBound);
    } catch (error) {
      this.#onRejected(error);
    }
  }

  #onFulfilled(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return;

      if (value && typeof value.then === "function") {
        value.then(this.#onFulfilledBound, this.#onRejectedBound);
        return;
      }

      this.#value = value;
      this.#state = STATE.FULFILLED;
      this.#runCallbacks();
    });
  }

  #onRejected(value) {
    queueMicrotask(() => {
      if (this.#state !== STATE.PENDING) return;

      if (value && typeof value.then === "function") {
        value.then(this.#onFulfilledBound, this.#onRejectedBound);
        return;
      }

      if (this.#catchCallbacks.length === 0) {
        throw new UncaughtPromiseError(value);
      }

      this.#value = value;
      this.#state = STATE.REJECTED;
      this.#runCallbacks();
    });
  }

  #runCallbacks() {
    if (this.#state === STATE.FULFILLED) {
      for (const thenCb of this.#thenCallbacks) {
        thenCb(this.#value);
      }

      this.#thenCallbacks = [];
    }
    if (this.#state === STATE.REJECTED) {
      for (const catchCb of this.#catchCallbacks) {
        catchCb(this.#value);
      }

      this.#catchCallbacks = [];
    }
  }

  then(thenCb, catchCb) {
    return new MyPromise((resolve, reject) => {
      this.#thenCallbacks.push((value) => {
        if (thenCb == undefined) {
          resolve(value);
          return;
        }

        try {
          resolve(thenCb(value));
        } catch (error) {
          reject(error);
        }
      });

      this.#catchCallbacks.push((value) => {
        if (catchCb == undefined) {
          reject(value);
          return;
        }

        try {
          resolve(catchCb(value));
        } catch (error) {
          reject(error);
        }
      });

      this.#runCallbacks();
    });
  }

  catch(catchCb) {
    return this.then(undefined, catchCb);
  }

  finally(callback) {
    return this.then(
      (result) => {
        callback();
        return result;
      },
      (result) => {
        callback();
        throw result;
      }
    );
  }

  static resolve(value) {
    return new MyPromise((resolve) => {
      resolve(value);
    });
  }

  static reject(value) {
    return new MyPromise((_, reject) => {
      reject(value);
    });
  }

  static all(promiseArray = []) {
    if (!promiseArray.length) return MyPromise.resolve([]);

    const resultArray = Array(promiseArray.length);
    let fulfilledAmount = 0;

    return new MyPromise((resolve, reject) => {
      promiseArray.forEach((promise, index) => {
        promise
          .then((value) => {
            resultArray[index] = value;
            fulfilledAmount++;

            if (fulfilledAmount === resultArray.length) {
              resolve(resultArray);
            }
          })
          .catch((error) => reject(error));
      });
    });
  }

  static allSettled(promiseArray = []) {
    if (!promiseArray.length) return MyPromise.resolve([]);

    const resultArray = Array(promiseArray.length);
    let fulfilledAmount = 0;

    return new MyPromise((resolve) => {
      promiseArray.forEach((promise, index) => {
        promise
          .then(
            (value) => {
              resultArray[index] = { status: STATE.FULFILLED, value };
            },
            (error) => {
              resultArray[index] = { status: STATE.REJECTED, reason: error };
            }
          )
          .finally(() => {
            fulfilledAmount++;

            if (fulfilledAmount === resultArray.length) {
              resolve(resultArray);
            }
          });
      });
    });
  }

  static any(promiseArray = []) {
    if (!promiseArray.length) return MyPromise.resolve([]);

    const resultArray = Array(promiseArray.length);
    let rejectedAmount = 0;

    return new MyPromise((resolve, reject) => {
      promiseArray.forEach((promise, index) => {
        promise.then(
          (value) => resolve(value),
          (error) => {
            resultArray[index] = error;
            rejectedAmount++;

            if (rejectedAmount === resultArray.length) {
              reject(resultArray);
            }
          }
        );
      });
    });
  }

  static race(promiseArray = []) {
    if (!promiseArray.length) return MyPromise.resolve([]);

    return new MyPromise((resolve, reject) => {
      promiseArray.forEach((promise) => {
        promise.then(
          (value) => {
            resolve(value);
          },
          (error) => reject(error)
        );
      });
    });
  }
}

module.exports = MyPromise;

class UncaughtPromiseError extends Error {
  constructor(error) {
    super(error);

    this.stack = `(in promise) ${error.stack}`;
  }
}
