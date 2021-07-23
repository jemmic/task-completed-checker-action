import marked from 'marked'

export function removeIgnoreTaskListText(text: string): string {
  return text
    .replace(
      /<!--\s*ignore-task-list-start\s*-->[\d\D]*?<!--\s*ignore-task-list-end\s*-->/g,
      ''
    )
    .replace(
      /<!--\s*ignore-task-list-start\s*-->[\d\D]*(?!<!--\s*ignore-task-list-end\s*-->)/g,
      ''
    )
}

export interface Tasks {
  completed: string[]
  uncompleted: string[]
}

export function getTasks(text: string): Tasks {
  const result = {
    completed: [],
    uncompleted: []
  }
  if (text === null) {
    return result
  }
  const withoutIgnored = removeIgnoreTaskListText(text)
  const list_items: marked.Tokens.ListItem[] = []
  marked(withoutIgnored, {
    gfm: true,
    walkTokens: token => {
      if (token.type === 'list_item') {
        list_items.push(token)
      }
    }
  })
  const hasChild = (token: marked.Tokens.ListItem): boolean => {
    const tokens = ((token as unknown) as {tokens: marked.Tokens.ListItem[]})
      .tokens
    return tokens && tokens.length > 0
  }
  const getFirstChildRaw = (token: marked.Tokens.ListItem): string => {
    const tokens = ((token as unknown) as {tokens: marked.Tokens.ListItem[]})
      .tokens
    return tokens[0].raw
  }
  return {
    completed: list_items
      .filter(token => token.checked === true && hasChild(token))
      .map(token => getFirstChildRaw(token)),
    uncompleted: list_items
      .filter(token => token.checked === false && hasChild(token))
      .map(token => getFirstChildRaw(token))
  }
}

export function createTaskListText(tasks: Tasks): string {
  const completedTasks = tasks.completed
  const uncompletedTasks = tasks.uncompleted

  let text = ''

  if (completedTasks !== null) {
    for (let index = 0; index < completedTasks.length; index++) {
      if (index === 0) {
        text += '## :white_check_mark: Completed Tasks\n'
      }
      text += `- [x] ${completedTasks[index]}\n`
    }
  }

  if (uncompletedTasks !== null) {
    for (let index = 0; index < uncompletedTasks.length; index++) {
      if (index === 0) {
        text += '## :x: Uncompleted Tasks\n'
      }
      text += `- [ ] ${uncompletedTasks[index]}\n`
    }
  }

  return text
}
