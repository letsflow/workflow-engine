![letsflow](https://github.com/letsflow/workflow-engine/assets/100821/3852a14e-90f8-4f8f-a334-09516f43bbc1)

## Description

LetsFlow is a workflow engine for running processes, described in YAML or JSON.

```yaml
schema: "https://schemas.letsflow.io/v1.0.0/scenario#"
title: My first scenario

actors:
  user:
    title: The user

actions:
  complete:
    title: Complete the process

states:
  initial:
    on: complete
    goto: (success)
```

The scenario models a process as a fine state machine. The actors are persons, organizations or systems that are allowed to participate on the process by performing actions. Which actions can be performed depends on the current state of the process. After an action has been, the process will transition to a different state.

**[Read the documentation](https://www.letsflow.io/)**

## Installation

```bash
$ npm install
```

## Running the app

```bash
# development
$ npm run start

# production mode
$ npm run start:prod
```

## Test

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```
