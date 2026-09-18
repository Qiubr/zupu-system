/**
 * 轻量 IndexedDB Promise 封装（零依赖）
 * 只覆盖本项目需要的能力：打开/升级、单条与批量读写、按索引查询、清空、计数。
 *
 * 用法：
 *   await ZP.idb.open();
 *   await ZP.idb.put('persons', person);
 *   const all = await ZP.idb.getAll('persons');
 */
(function (global) {
  'use strict';
  var ZP = (global.ZP = global.ZP || {});
  var S = ZP.schema;

  var _db = null;

  /** 打开数据库（幂等）。首次或版本升级时按 STORE_DEFS 建表与索引。 */
  function open() {
    if (_db) return Promise.resolve(_db);
    return new Promise(function (resolve, reject) {
      var req = indexedDB.open(S.DB_NAME, S.DB_VERSION);

      req.onupgradeneeded = function (e) {
        var db = e.target.result;
        Object.keys(S.STORE_DEFS).forEach(function (name) {
          var def = S.STORE_DEFS[name];
          var store;
          if (!db.objectStoreNames.contains(name)) {
            store = db.createObjectStore(name, { keyPath: def.keyPath });
          } else {
            store = e.target.transaction.objectStore(name);
          }
          (def.indexes || []).forEach(function (idx) {
            if (!store.indexNames.contains(idx.name)) {
              store.createIndex(idx.name, idx.keyPath, { unique: false });
            }
          });
        });
      };

      req.onsuccess = function (e) {
        _db = e.target.result;
        // 连接意外关闭时清空缓存，下次调用自动重连
        _db.onclose = function () { _db = null; };
        resolve(_db);
      };

      req.onerror = function (e) { reject(e.target.error); };
      req.onblocked = function () { reject(new Error('数据库被其他标签页占用，请关闭后重试')); };
    });
  }

  /** 执行一次事务并等待完成，返回 request 的结果（可传多个 request） */
  function run(storeNames, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(storeNames, mode);
        var result;
        tx.oncomplete = function () { resolve(result); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('事务中止')); };
        try {
          result = fn(tx);
        } catch (err) {
          try { tx.abort(); } catch (ignore) {}
          reject(err);
        }
      });
    });
  }

  /** 把单个 IDBRequest 包成 Promise */
  function reqPromise(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  function get(store, key) {
    return open().then(function (db) {
      return reqPromise(db.transaction(store, 'readonly').objectStore(store).get(key));
    });
  }

  function getAll(store) {
    return open().then(function (db) {
      return reqPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
    });
  }

  function getAllByIndex(store, indexName, value) {
    return open().then(function (db) {
      return reqPromise(
        db.transaction(store, 'readonly').objectStore(store).index(indexName).getAll(value)
      );
    });
  }

  /** 按索引范围查询，range 由 IDBKeyRange 构造 */
  function getAllByRange(store, indexName, range) {
    return open().then(function (db) {
      return reqPromise(
        db.transaction(store, 'readonly').objectStore(store).index(indexName).getAll(range)
      );
    });
  }

  function put(store, value) {
    return run(store, 'readwrite', function (tx) {
      return tx.objectStore(store).put(value);
    }).then(function () { return value; });
  }

  /** 批量写入（单事务），values 为数组 */
  function bulkPut(store, values) {
    if (!values || !values.length) return Promise.resolve(0);
    return run(store, 'readwrite', function (tx) {
      var os = tx.objectStore(store);
      values.forEach(function (v) { os.put(v); });
    }).then(function () { return values.length; });
  }

  function del(store, key) {
    return run(store, 'readwrite', function (tx) {
      tx.objectStore(store).delete(key);
    });
  }

  function bulkDel(store, keys) {
    if (!keys || !keys.length) return Promise.resolve(0);
    return run(store, 'readwrite', function (tx) {
      var os = tx.objectStore(store);
      keys.forEach(function (k) { os.delete(k); });
    }).then(function () { return keys.length; });
  }

  function clear(store) {
    return run(store, 'readwrite', function (tx) {
      tx.objectStore(store).clear();
    });
  }

  /** 清空全部业务表（不含 meta） */
  function clearAll() {
    return run(['persons', 'marriages', 'branches', 'photos'], 'readwrite', function (tx) {
      ['persons', 'marriages', 'branches', 'photos'].forEach(function (s) {
        tx.objectStore(s).clear();
      });
    });
  }

  function count(store) {
    return open().then(function (db) {
      return reqPromise(db.transaction(store, 'readonly').objectStore(store).count());
    });
  }

  /** 删除整个数据库（调试用） */
  function destroy() {
    return new Promise(function (resolve, reject) {
      if (_db) { _db.close(); _db = null; }
      var req = indexedDB.deleteDatabase(S.DB_NAME);
      req.onsuccess = function () { resolve(true); };
      req.onerror = function () { reject(req.error); };
      req.onblocked = function () { reject(new Error('删除被阻塞')); };
    });
  }

  ZP.idb = {
    open: open,
    get: get,
    getAll: getAll,
    getAllByIndex: getAllByIndex,
    getAllByRange: getAllByRange,
    put: put,
    bulkPut: bulkPut,
    del: del,
    bulkDel: bulkDel,
    clear: clear,
    clearAll: clearAll,
    count: count,
    destroy: destroy
  };
})(window);
