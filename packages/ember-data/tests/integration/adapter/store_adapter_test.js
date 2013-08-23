/**
 This is an integration test that tests the communication between a store
 and its adapter.

 Typically, when a method is invoked on the store, it calls a related
 method on its adapter. The adapter notifies the store that it has
 completed the assigned task, either synchronously or asynchronously,
 by calling a method on the store.

 These tests ensure that the proper methods get called, and, if applicable,
 the given record orrecord arrayay changes state appropriately.
*/

var get = Ember.get, set = Ember.set;
var Person, Dog, env, store, adapter;

module("integration/adapter/store_adapter - DS.Store and DS.Adapter integration test", {
  setup: function() {
    Person = DS.Model.extend({
      updatedAt: DS.attr('string'),
      name: DS.attr('string'),
      firstName: DS.attr('string'),
      lastName: DS.attr('string')
    });

    Dog = DS.Model.extend({
      name: DS.attr('string')
    });

    env = setupStore({ person: Person, dog: Dog });
    store = env.store;
    adapter = env.adapter;
  },

  teardown: function() {
    env.container.destroy();
  }
});


test("Records loaded multiple times and retrieved in recordArray are ready to send state events", function() {
  adapter.findQuery = function(store, type, query, recordArray) {
    return Ember.RSVP.resolve([{
      id: 1,
      name: "Mickael Ramírez"
    }, {
      id: 2,
      name: "Johny Fontana"
    }]);
  };

  store.findQuery('person', {q: 'bla'}).then(async(function(people) {
    var people2 = store.findQuery('person', { q: 'bla2' });

    return Ember.RSVP.hash({ people: people, people2: people2 });
  })).then(async(function(results) {
    equal(results.people2.get('length'), 2, 'return the elements' );
    ok( results.people2.get('isLoaded'), 'array is loaded' );

    var person = results.people.objectAt(0);
    ok(person.get('isLoaded'), 'record is loaded');

    // delete record will not throw exception
    person.deleteRecord();
  }));

});

test("by default, createRecords calls createRecord once per record", function() {
  var count = 1;

  adapter.createRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    if (count === 1) {
      equal(get(record, 'name'), "Tom Dale");
    } else if (count === 2) {
      equal(get(record, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not have invoked more than 2 times");
    }

    var hash = get(record, 'data');
    hash.id = count;
    hash.updatedAt = "now";

    count++;
    return Ember.RSVP.resolve(hash);
  };

  var tom = store.createRecord('person', { name: "Tom Dale" });
  var yehuda = store.createRecord('person', { name: "Yehuda Katz" });

  Ember.RSVP.hash({ tom: tom.save(), yehuda: yehuda.save() }).then(async(function(records) {
    tom = records.tom;
    yehuda = records.yehuda;

    asyncEqual(tom, store.find('person', 1), "Once an ID is in, find returns the same object");
    asyncEqual(yehuda, store.find('person', 2), "Once an ID is in, find returns the same object");
    equal(get(tom, 'updatedAt'), "now", "The new information is received");
    equal(get(yehuda, 'updatedAt'), "now", "The new information is received");
  }));
});

test("by default, updateRecords calls updateRecord once per record", function() {
  var count = 0;

  adapter.updateRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    if (count === 0) {
      equal(get(record, 'name'), "Tom Dale");
    } else if (count === 1) {
      equal(get(record, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not get here");
    }

    count++;

    equal(record.get('isSaving'), true, "record is saving");

    return Ember.RSVP.resolve();
  };

  store.push('person', { id: 1, name: "Braaaahm Dale" });
  store.push('person', { id: 2, name: "Brohuda Katz" });

  Ember.RSVP.hash({ tom: store.find('person', 1), yehuda: store.find('person', 2) }).then(async(function(records) {
    var tom = records.tom, yehuda = records.yehuda;

    set(tom, "name", "Tom Dale");
    set(yehuda, "name", "Yehuda Katz");

    return Ember.RSVP.hash({ tom: tom.save(), yehuda: yehuda.save() });
  })).then(async(function(records) {
    var tom = records.tom, yehuda = records.yehuda;

    equal(tom.get('isSaving'), false, "record is no longer saving");
    equal(tom.get('isLoaded'), true, "record is loaded");

    equal(yehuda.get('isSaving'), false, "record is no longer saving");
    equal(yehuda.get('isLoaded'), true, "record is loaded");
  }));
});

test("calling store.didSaveRecord can provide an optional hash", function() {
  var count = 0;

  adapter.updateRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    count++;
    if (count === 1) {
      equal(get(record, 'name'), "Tom Dale");
      return Ember.RSVP.resolve({ id: 1, name: "Tom Dale", updatedAt: "now" });
    } else if (count === 2) {
      equal(get(record, 'name'), "Yehuda Katz");
      return Ember.RSVP.resolve({ id: 2, name: "Yehuda Katz", updatedAt: "now!" });
    } else {
      ok(false, "should not get here");
    }
  };

  store.push('person', { id: 1, name: "Braaaahm Dale" });
  store.push('person', { id: 2, name: "Brohuda Katz" });

  Ember.RSVP.hash({ tom: store.find('person', 1), yehuda: store.find('person', 2) }).then(async(function(records) {
    var tom = records.tom, yehuda = records.yehuda;

    set(tom, "name", "Tom Dale");
    set(yehuda, "name", "Yehuda Katz");

    return Ember.RSVP.hash({ tom: tom.save(), yehuda: yehuda.save() });
  })).then(async(function(records) {
    var tom = records.tom, yehuda = records.yehuda;

    equal(get(tom, 'isDirty'), false, "the record should not be dirty");
    equal(get(tom, 'updatedAt'), "now", "the hash was updated");

    equal(get(yehuda, 'isDirty'), false, "the record should not be dirty");
    equal(get(yehuda, 'updatedAt'), "now!", "the hash was updated");
  }));
});

test("by default, deleteRecords calls deleteRecord once per record", function() {
  expect(4);

  var count = 0;

  adapter.deleteRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    if (count === 0) {
      equal(get(record, 'name'), "Tom Dale");
    } else if (count === 1) {
      equal(get(record, 'name'), "Yehuda Katz");
    } else {
      ok(false, "should not get here");
    }

    count++;

    return Ember.RSVP.resolve();
  };

  store.push('person', { id: 1, name: "Tom Dale" });
  store.push('person', { id: 2, name: "Yehuda Katz" });

  Ember.RSVP.hash({ tom: store.find('person', 1), yehuda: store.find('person', 2) }).then(async(function(records) {
    var tom = records.tom, yehuda = records.yehuda;

    tom.deleteRecord();
    yehuda.deleteRecord();

    tom.save();
    yehuda.save();
  }));
});

test("if an existing model is edited then deleted, deleteRecord is called on the adapter", function() {
  expect(5);

  var count = 0;

  adapter.deleteRecord = function(store, type, record) {
    count++;
    equal(get(record, 'id'), 'deleted-record', "should pass correct record to deleteRecord");
    equal(count, 1, "should only call deleteRecord method of adapter once");

    return Ember.RSVP.resolve();
  };

  adapter.updateRecord = function() {
    ok(false, "should not have called updateRecord method of adapter");
  };

  // Load data for a record into the store.
  store.push('person', { id: 'deleted-record', name: "Tom Dale" });

  // Retrieve that loaded record and edit it so it becomes dirty
  store.find('person', 'deleted-record').then(async(function(tom) {
    tom.set('name', "Tom Mothereffin' Dale");

    equal(get(tom, 'isDirty'), true, "precond - record should be dirty after editing");

    tom.deleteRecord();
    return tom.save();
  })).then(async(function(tom) {
    equal(get(tom, 'isDirty'), false, "record should not be dirty");
    equal(get(tom, 'isDeleted'), true, "record should be considered deleted");
  }));
});

test("if a created record is marked as invalid by the server, it enters an error state", function() {
  adapter.createRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    if (get(record, 'name').indexOf('Bro') === -1) {
      return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
    } else {
      return Ember.RSVP.resolve();
    }
  };

  var yehuda = store.createRecord('person', { id: 1, name: "Yehuda Katz" });

  // Wrap this in an Ember.run so that all chained async behavior is set up
  // before flushing any scheduled behavior.
  Ember.run(function() {
    yehuda.save().then(null, async(function(error) {
      equal(get(yehuda, 'isValid'), false, "the record is invalid");
      ok(get(yehuda, 'errors.name'), "The errors.name property exists");

      set(yehuda, 'updatedAt', true);
      equal(get(yehuda, 'isValid'), false, "the record is still invalid");

      // This tests that we handle undefined values without blowing up
      var errors = get(yehuda, 'errors');
      set(errors, 'other_bound_property', undefined);
      set(yehuda, 'errors', errors);
      set(yehuda, 'name', "Brohuda Brokatz");

      equal(get(yehuda, 'isValid'), true, "the record is no longer invalid after changing");
      equal(get(yehuda, 'isDirty'), true, "the record has outstanding changes");

      equal(get(yehuda, 'isNew'), true, "precond - record is still new");

      return yehuda.save();
    })).then(async(function(person) {
      strictEqual(person, yehuda, "The promise resolves with the saved record");

      equal(get(yehuda, 'isValid'), true, "record remains valid after committing");
      equal(get(yehuda, 'isNew'), false, "record is no longer new");
    }));
  });
});

test("if a created record is marked as erred by the server, it enters an error state", function() {
  adapter.createRecord = function(store, type, record) {
    return Ember.RSVP.reject();
  };

  Ember.run(function() {
    var person = store.createRecord('person', { id: 1, name: "John Doe" });

    person.save().then(null, async(function() {
      ok(get(person, 'isError'), "the record is in the error state");
    }));
  });
});

test("if an updated record is marked as invalid by the server, it enters an error state", function() {
  adapter.updateRecord = function(store, type, record) {
    equal(type, Person, "the type is correct");

    if (get(record, 'name').indexOf('Bro') === -1) {
      return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
    } else {
      return Ember.RSVP.resolve();
    }
  };

  store.push('person', { id: 1, name: "Brohuda Brokatz" });

  Ember.run(function() {
    store.find('person', 1).then(async(function(yehuda) {
      equal(get(yehuda, 'isValid'), true, "precond - the record is valid");
      set(yehuda, 'name', "Yehuda Katz");
      equal(get(yehuda, 'isValid'), true, "precond - the record is still valid as far as we know");

      equal(get(yehuda, 'isDirty'), true, "the record is dirty");

      return yehuda.save();
    })).then(null, async(function(yehuda) {
      equal(get(yehuda, 'isDirty'), true, "the record is still dirty");
      equal(get(yehuda, 'isValid'), false, "the record is invalid");

      set(yehuda, 'updatedAt', true);
      equal(get(yehuda, 'isValid'), false, "the record is still invalid");

      set(yehuda, 'name', "Brohuda Brokatz");
      equal(get(yehuda, 'isValid'), true, "the record is no longer invalid after changing");
      equal(get(yehuda, 'isDirty'), true, "the record has outstanding changes");

      return yehuda.save();
    })).then(async(function(yehuda) {
      equal(get(yehuda, 'isValid'), true, "record remains valid after committing");
      equal(get(yehuda, 'isDirty'), false, "record is no longer new");
    }));
  });
});

test("if a updated record is marked as erred by the server, it enters an error state", function() {
  adapter.updateRecord = function(store, type, record) {
    return Ember.RSVP.reject();
  };

  store.push(Person, { id: 1, name: "John Doe" });

  store.find('person', 1).then(async(function(person) {
    person.set('name', "Jonathan Doe");
    return person.save();
  })).then(null, async(function(person) {
    ok(get(person, 'isError'), "the record is in the error state");
  }));
});

test("can be created after the DS.Store", function() {
  expect(1);

  adapter.find = function(store, type) {
    equal(type, Person, "the type is correct");
    return Ember.RSVP.resolve({ id: 1 });
  };

  store.find('person', 1);
});

test("the filter method can optionally take a server query as well", function() {
  adapter.findQuery = function(store, type, query, array) {
    return Ember.RSVP.resolve([
      { id: 1, name: "Yehuda Katz" },
      { id: 2, name: "Tom Dale" }
    ]);
  };

  var asyncFilter = store.filter('person', { page: 1 }, function(data) {
    return data.get('name') === "Tom Dale";
  });

  var loadedFilter;

  asyncFilter.then(async(function(filter) {
    loadedFilter = filter;
    return store.find('person', 2);
  })).then(async(function(tom) {
    equal(get(loadedFilter, 'length'), 1, "The filter has an item in it");
    deepEqual(loadedFilter.toArray(), [ tom ], "The filter has a single entry in it");
  }));
});
