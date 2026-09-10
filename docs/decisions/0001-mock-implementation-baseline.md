# 0001 Mock Implementation Baseline

Date: 2026-09-10

## Status

Accepted

## Context

The approved System Design deliberately leaves several production policies configurable while the challenge implementation must still provide deterministic mocked behavior. The autonomous dry run identified four bounded ambiguities that would otherwise block implementation tasks T02, T03, and T06.

This decision supplies implementation authority for the frontend challenge only. It does not redefine the production architecture or claim that these demo defaults are production business policy.

## Decision

### Current-inventory membership and action eligibility

For the mock implementation, `isPresentInLatestSnapshot === true` means the vehicle is present in current inventory.

Lifecycle values such as `AVAILABLE`, `RESERVED`, `SOLD`, and `UNAVAILABLE` remain visible/filterable upstream facts and do not independently make a present vehicle ineligible for an action unless a later accepted product decision adds that rule.

Creating an action therefore requires all of the following:

- the vehicle exists;
- `isPresentInLatestSnapshot === true`;
- the vehicle is aging according to the authoritative backend/mock aging policy;
- the selected action status exists and is active;
- the trusted mock actor is authorized;
- the optional note satisfies the API shape below.

### Note validation

The note remains optional as designed.

The mock API accepts:

- omitted note;
- `null`;
- any string value, including an empty string.

No arbitrary business length limit, required-content rule, keyword restriction, or sanitization policy is invented for this challenge. UI code may normalize an untouched empty draft to `null`, but validation must not introduce a new business rule.

### Demo configuration

The mock implementation uses deterministic demo defaults:

- dealership timezone: `UTC`;
- freshness-warning threshold: `30 minutes`.

These are fixture/configuration defaults, not production policy. Aging logic must still be written and tested as dealership-timezone-aware behavior, including non-UTC boundary cases.

### Mock authorization contract

Authentication implementation remains out of scope.

The mock HTTP boundary supplies a trusted actor context that cannot be provided or overridden by the action POST body.

Default fixture behavior uses an authorized manager actor. Tests/error fixtures may explicitly select an unauthorized actor/context to prove authorization rejection.

No role hierarchy or production RBAC model is invented beyond the binary authorized/unauthorized behavior needed to exercise the designed contract.

## Alternatives Considered

1. Block implementation until production policy values are supplied. Rejected because the challenge explicitly uses a mock backend and the missing values are bounded demo/configuration choices.
2. Infer lifecycle eligibility from `AVAILABLE` only. Rejected because the System Design does not authorize lifecycle status as an additional action gate.
3. Add arbitrary note limits or required-note behavior. Rejected because that would invent product policy.
4. Implement mock RBAC roles. Rejected because authentication/identity implementation is outside challenge scope.

## Consequences

Positive:

- T02, T03, and T06 can proceed without human clarification.
- Mock behavior is deterministic and testable.
- Production-configurable concerns remain distinguishable from demo defaults.
- Action eligibility stays aligned with the explicit System Design validation sequence.

Tradeoffs:

- Demo timezone and freshness defaults are intentionally simplistic.
- Lifecycle values remain informational for action eligibility until product authority says otherwise.
- Note validation proves contract shape rather than a richer product policy.

## Follow-Up

- Task Contracts for T02/T03/T06 must reference this decision where applicable.
- Tests must include 89/90/91-day aging boundaries and at least one non-UTC dealership-calendar boundary.
- Action POST tests must prove trusted actor injection and unauthorized rejection.
- Do not promote these demo defaults into production design claims.