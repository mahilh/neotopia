# DOES THE FLAG COLUMN FIX THE CLASS, OR RE-SKIN IT?

**T2 S56 · August 12 2026 · answering the question that overturns a Council ruling.**
**Every premise below was checked against the live database, not reasoned about.**

---

## THE SHORT ANSWER

**The flag column as recorded re-skins it. Keying on the CREDENTIAL fixes it, it IS buildable, and it
also closes a leak an order of magnitude larger that nobody has been counting.**

---

## 1 · WHY THE COLUMN AS RECORDED DOES NOT FIX THE CLASS

`src/lib/reservedNames.js` records the destination as `player_profiles.is_test boolean`, set by the
harness and checked by the purge. The failure mode of the prefix scheme is:

> a producer has to remember to put its identity inside the namespace.

The failure mode of a column the harness sets is:

> a producer has to remember to set the column.

**Same forgetting, different type.** The 49 leaked profiles are not evidence that a string was the
wrong representation; they are evidence that **anything a test writes about itself can be omitted by a
test that does not know the rule** · and the producers are dynamically-constructed names in three
lanes that my own S52 guard cannot enumerate.

## 2 · THE VERSION THAT CANNOT BE FORGOTTEN

Make the database stamp the row from the **credential**, so the producer never writes the flag at all.

| leg | verified | result |
|---|---|---|
| can a trigger read JWT claims? | `pg_proc` for `auth.jwt` | **exists** |
| can a client forge `app_metadata`? | grants on `auth.users` for anon/authenticated | **zero grants, zero policies** |
| is there an insertion point? | non-internal triggers on the two tables | **0 · clean** |
| do flagged users exist today? | `auth.users where raw_app_meta_data ? 'is_test'` | **0 of 5724** |

```sql
-- BEFORE INSERT on player_profiles / game_rooms
new.is_test := coalesce((auth.jwt() -> 'app_metadata' ->> 'is_test')::boolean, false);
```

`app_metadata` is settable only through the admin API. A client has **no grants on `auth.users` at
all** · not even SELECT · so a test cannot lie about being a test, and, more importantly, **cannot
fail to declare it.** The purge then selects `where is_test`, and the reserved-prefix scheme,
`isReservedUsername`, `isSweptByPurge`, the drift guard and the producer guard all become deletable.

## 3 · THE LEAK NOBODY WAS COUNTING, AND WHY IT DECIDES THIS

While checking leg 4 I measured `auth.users`:

| | |
|---|---|
| total | **5724** |
| created in the last 24h | **1237** |
| sustained rate | **~449 / day** |
| that have a profile | 57 |
| that hosted a room | 664 |
| **that left NO TRACE at all** | **5025 · 88%** |
| non-anonymous | **0** |

Every one is an anonymous sign-in. The purge has never touched `auth.users` and cannot · it is not in
`public`. So the row leak I have been reporting (50 profiles, 640 rooms) is the **small** one; the
identity churn is two orders of magnitude bigger and grows at ~450/day against a documented per-IP
anon budget of 30/hour (`docs/ANON_SIGNIN_BUDGET.md`).

**This is what makes the credential approach the answer rather than a tidier column.** If CI signs in
as a **fixed pool** of pre-created test users instead of minting one per test:

- rows get tagged from the credential · the tagging problem is closed, unforgettably
- **the churn stops** · ~10 reused identities instead of ~450 new ones a day
- the anon-budget pressure that has shaped E2E routing for ten sessions largely goes away

One change, three problems. The column alone closes none of them.

## 4 · WHAT IT COSTS, HONESTLY

| | lane | cost |
|---|---|---|
| create ~10 test users with `app_metadata.is_test` | one-off admin script | small |
| repo secrets for those credentials | `.github` | small |
| **the app must choose a different auth path under `VITE_E2E`** | `src/hooks/useAuth.js` | **the real cost** |
| `is_test` column + trigger on 2 tables | migration | small |
| purge predicate + backfill | migration | small |
| harness stops calling `signInAnonymously` | `tests/e2e` (T3) | medium |

**The real cost is the third row and it should not be glossed.** `useAuth.js:54` calls
`supabase.auth.signInAnonymously()`, and CI drives the *real UI*, so CI cannot authenticate
differently unless the product offers a different path under a build flag. That is a product change
for a test concern.

**It is precedented and the precedent is mine**: `useAuth.js` already branches on
`import.meta.env.VITE_E2E` for the reserved-name bypass, and the bundle is asserted to carry no trace
of it (`reservedNames.test.js`). The same pattern, the same guard, one more branch.

**And it is not free of risk**: a credential path in the product is a bigger surface than a name
check. It must be statically eliminated from production builds, which is exactly what the existing
bundle assertion already proves for the flag it guards.

## 5 · RECOMMENDATION

**Void the Council's flag-column ruling as recorded, and replace it with the credential design.** Not
because a column is wrong · the column is *part* of the answer · but because the ruling specifies the
harness setting it, which reproduces the failure it was chosen to end.

**Do not build it on a session tail.** It spans three lanes and touches the auth path. Scoped here so
the decision is cheap; the build is a session of its own with T3, and the sequencing that de-risks it
is: fixed-pool sign-in first (closes the churn, needs no schema), then the trigger and the column
(closes the tagging), then delete the prefix machinery.
