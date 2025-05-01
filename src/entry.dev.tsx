import { render, type RenderOptions } from '@builder.io/qwik'
import Root from './root'

export default function (opts: RenderOptions) {
  return render(document, <Root />, {
    ...opts,
    // Remove containerAttributes as it's not part of RenderOptions
  })
}
