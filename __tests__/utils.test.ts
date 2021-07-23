import {removeIgnoreTaskListText, getTasks, createTaskListText} from '../src/utils'

describe('removeIgnoreTaskListText', () => {
  it('removes multiple ignore task list from task list text.', () => {
    const text = `## Issue Type
    <!-- ignore-task-list-start -->
    - [ ] Bug
    * [ ] Document
    - [x] Enhancement Feature
    <!-- ignore-task-list-end -->
    <!-- ignore-task-list-start -->
    - [ ] Other
    * [X] list
    <!-- ignore-task-list-end -->
    
    ## Checklist
    - [x] I have read the [CONTRIBUTING.md]()
    - [x] I have made corresponding changes to the documentation
    - [x] My changes generate no lint errors
    - [X] I have added tests that prove my fix is effective or that my feature works
    - [x] New and existing unit tests pass locally with my changes`

    const result = removeIgnoreTaskListText(text)

    expect(result).toEqual(`## Issue Type
    
    
    
    ## Checklist
    - [x] I have read the [CONTRIBUTING.md]()
    - [x] I have made corresponding changes to the documentation
    - [x] My changes generate no lint errors
    - [X] I have added tests that prove my fix is effective or that my feature works
    - [x] New and existing unit tests pass locally with my changes`)
  })

  it('removes single ignore task list from task list text.', () => {
    const text = `<!-- ignore-task-list-start -->
    - [ ] foo
    - [x] qwer
    - [x]
    * [ ]
    * [ ] hello
    * [x] world
    <!-- ignore-task-list-end -->
    - [x] bar`

    const result = removeIgnoreTaskListText(text)

    expect(result).toEqual(`
    - [x] bar`)
  })

  it('skips remove process if task list text does not contain ignore task list.', () => {
    const text = '- [x] bar'

    const result = removeIgnoreTaskListText(text)

    expect(result).toEqual('- [x] bar')
  })
})

describe('createTaskListText', () => {
  it('creates a list of completed tasks', () => {
    const text = `## Issue Type


## Checklist
- [x] I have read the [CONTRIBUTING.md]()
* [x] I have made corresponding changes to the **documentation**
* Not a task list item
- [x] My changes generate no _lint_ errors
  - [x] I have added tests that prove my fix is effective or that my feature works
  - Another not a task list item
  - [x] New and existing unit tests pass locally with my changes`

    const result = createTaskListText(getTasks(text))

    expect(result).toEqual(`## :white_check_mark: Completed Tasks
- [x] I have read the [CONTRIBUTING.md]()
- [x] I have made corresponding changes to the **documentation**
- [x] My changes generate no _lint_ errors
- [x] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes
`)
  })

  it('creates a list of completed tasks and uncompleted tasks', () => {
    const text = `## Issue Type


## Checklist
- [x] I have read the [CONTRIBUTING.md]()
- [ ] I have made corresponding changes to the documentation
* [ ] 
* [x]
- [X] My changes generate no lint errors
- [ ] I have added tests that prove my fix is effective or that my feature works
- [x] New and existing unit tests pass locally with my changes`

    const result = createTaskListText(getTasks(text))

    expect(result).toEqual(`## :white_check_mark: Completed Tasks
- [x] I have read the [CONTRIBUTING.md]()
- [x] My changes generate no lint errors
- [x] New and existing unit tests pass locally with my changes
## :x: Uncompleted Tasks
- [ ] I have made corresponding changes to the documentation
- [ ] I have added tests that prove my fix is effective or that my feature works
`)
  })
})
