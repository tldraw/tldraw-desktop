---
name: tldraw-skill
description: Provides guidance for using the tldraw SDK - an infinite canvas library for React applications.
---

tldraw is a React-based infinite canvas SDK. The main package `tldraw` provides a "batteries included" experience with shapes, tools, and UI. The lower-level `@tldraw/editor` package provides just the core engine without any shapes or UI.

**Documentation**: https://tldraw.dev
**Examples**: https://examples.tldraw.com
**GitHub**: https://github.com/tldraw/tldraw

## Installation

```bash
npm install tldraw
```

**Requirements**: React 18+, modern bundler (Vite, Next.js, etc.)

## Basic setup

### Minimal example

```tsx
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

export default function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw />
		</div>
	)
}
```

### Next.js setup

Next.js requires the `'use client'` directive since tldraw uses browser APIs:

```tsx
'use client'
import { Tldraw } from 'tldraw'
import 'tldraw/tldraw.css'

export default function Home() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw />
		</div>
	)
}
```

### Using the editor API

Access the editor instance via the `onMount` callback:

```tsx
<Tldraw
	onMount={(editor) => {
		// Programmatic control
		editor.createShape({ type: 'geo', x: 100, y: 100 })
		editor.selectAll()
		editor.zoomToFit()
	}}
/>
```

## Core concepts

### Editor

The `Editor` class is the central API for controlling the canvas. Access it via `onMount` or the `useEditor()` hook inside tldraw components.

```tsx
// Common editor operations
editor.createShape({ type: 'geo', x: 0, y: 0 })
editor.updateShape({ id: shapeId, type: 'geo', props: { w: 200 } })
editor.deleteShapes([shapeId])
editor.selectAll()
editor.getSelectedShapes()
editor.getSelectionPageBounds()
editor.zoomToFit()
editor.setCurrentTool('draw')

// Batch multiple operations
editor.batch(() => {
	editor.createShape(shape1)
	editor.createShape(shape2)
})

// Subscribe to changes
editor.store.listen((entry) => {
	console.log('Store changed:', entry)
})
```

### Shapes

Shapes are defined by `ShapeUtil` classes. The SDK includes default shapes: text, draw, geo (rectangle, ellipse, etc.), arrow, note, frame, line, highlight, bookmark, embed, image, video.

### Tools

Tools are state machines implemented as `StateNode` classes. Default tools: select, hand, draw, eraser, arrow, text, note, frame, geo, line, highlight, laser, zoom.

### Store

The `TLStore` is a reactive database holding all document data (shapes, pages, assets). Built on `@tldraw/state` signals for automatic reactivity.

### Reactive state

tldraw uses a signals-based reactive system (`@tldraw/state`):

```tsx
import { atom, computed, react } from '@tldraw/state'

// Mutable state
const count = atom('count', 0)
count.set(5)

// Derived state
const doubled = computed('doubled', () => count.get() * 2)

// Side effects
const stop = react('logger', () => console.log(doubled.get()))
```

## Creating custom shapes

Custom shapes require a `ShapeUtil` class:

```tsx
import {
	Geometry2d,
	HTMLContainer,
	RecordProps,
	Rectangle2d,
	ShapeUtil,
	T,
	TLResizeInfo,
	TLShape,
	Tldraw,
	resizeBox,
} from 'tldraw'
import 'tldraw/tldraw.css'

// 1. Extend the type system
const MY_SHAPE_TYPE = 'my-custom-shape'

declare module 'tldraw' {
	export interface TLGlobalShapePropsMap {
		[MY_SHAPE_TYPE]: { w: number; h: number; text: string }
	}
}

// 2. Define the shape type
type IMyShape = TLShape<typeof MY_SHAPE_TYPE>

// 3. Create the ShapeUtil
class MyShapeUtil extends ShapeUtil<IMyShape> {
	static override type = MY_SHAPE_TYPE
	static override props: RecordProps<IMyShape> = {
		w: T.number,
		h: T.number,
		text: T.string,
	}

	getDefaultProps(): IMyShape['props'] {
		return { w: 200, h: 200, text: 'Hello!' }
	}

	// Hit testing, binding, bounds
	getGeometry(shape: IMyShape): Geometry2d {
		return new Rectangle2d({
			width: shape.props.w,
			height: shape.props.h,
			isFilled: true,
		})
	}

	// React component for rendering
	component(shape: IMyShape) {
		return <HTMLContainer style={{ backgroundColor: '#efefef' }}>{shape.props.text}</HTMLContainer>
	}

	// Selection indicator (SVG)
	indicator(shape: IMyShape) {
		return <rect width={shape.props.w} height={shape.props.h} />
	}

	// Optional: handle resize
	override onResize(shape: IMyShape, info: TLResizeInfo<IMyShape>) {
		return resizeBox(shape, info)
	}

	// Optional: capability flags
	override canResize() {
		return true
	}
	override canEdit() {
		return false
	}
}

// 4. Register with Tldraw
export default function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw
				shapeUtils={[MyShapeUtil]}
				onMount={(editor) => {
					editor.createShape({ type: MY_SHAPE_TYPE, x: 100, y: 100 })
				}}
			/>
		</div>
	)
}
```

**Tip**: Extend `BaseBoxShapeUtil` for rectangular shapes to avoid implementing `getGeometry` and `onResize`.

## Creating custom tools

Custom tools are `StateNode` subclasses:

```tsx
import { StateNode, Tldraw, toRichText } from 'tldraw'
import 'tldraw/tldraw.css'

class StickerTool extends StateNode {
	static override id = 'sticker'

	override onEnter() {
		this.editor.setCursor({ type: 'cross', rotation: 0 })
	}

	override onPointerDown() {
		const point = this.editor.inputs.getCurrentPagePoint()
		this.editor.createShape({
			type: 'text',
			x: point.x,
			y: point.y,
			props: { richText: toRichText('❤️') },
		})
	}

	// Other handlers: onPointerMove, onPointerUp, onKeyDown, onKeyUp, onExit
}

export default function App() {
	return (
		<div style={{ position: 'fixed', inset: 0 }}>
			<Tldraw tools={[StickerTool]} initialState="sticker" />
		</div>
	)
}
```

**Tool event handlers**:

- `onEnter()`, `onExit()` - lifecycle
- `onPointerDown()`, `onPointerMove()`, `onPointerUp()` - pointer events
- `onKeyDown()`, `onKeyUp()` - keyboard events
- `onTick()` - animation frame

## UI customization

### Hiding UI elements

```tsx
<Tldraw hideUi />  // Hide all UI
<Tldraw components={{ Toolbar: null }} />  // Hide specific components
```

### Overriding components

Every UI component can be replaced:

```tsx
import { TLComponents } from 'tldraw'

const components: TLComponents = {
	Toolbar: MyCustomToolbar,
	StylePanel: null, // Remove entirely
}

// Define components outside the React component to keep them static
export default function App() {
	return <Tldraw components={components} />
}
```

**Overridable components**: `Toolbar`, `StylePanel`, `MenuPanel`, `NavigationPanel`, `PageMenu`, `SharePanel`, `Canvas`, `Grid`, `Handles`, `SelectionBackground`, `SelectionForeground`, `Dialogs`, `Toasts`, and more.

### Accessing UI hooks

Inside tldraw components, use these hooks:

- `useEditor()` - access the editor instance
- `useActions()` - access registered actions
- `useDialogs()` - manage dialogs
- `useToasts()` - show notifications

## Persistence

### Local persistence with IndexedDB

```tsx
<Tldraw persistenceKey="my-document" />
```

### Loading/saving snapshots

```tsx
// Save
const snapshot = editor.store.getStoreSnapshot()
localStorage.setItem('doc', JSON.stringify(snapshot))

// Load
const snapshot = JSON.parse(localStorage.getItem('doc'))
editor.store.loadStoreSnapshot(snapshot)
```

### Creating a store externally

```tsx
import { createTLStore, defaultShapeUtils } from 'tldraw'

const store = createTLStore({
  shapeUtils: defaultShapeUtils,
})

<Tldraw store={store} />
```

## Multiplayer / real-time sync

### Using the demo server (prototyping)

```tsx
import { useSyncDemo } from '@tldraw/sync'
import { Tldraw } from 'tldraw'

export default function App() {
	const store = useSyncDemo({ roomId: 'my-room-id' })
	return <Tldraw store={store} />
}
```

### Production multiplayer

```tsx
import { useSync } from '@tldraw/sync'
import { Tldraw, TLAssetStore } from 'tldraw'

const assetStore: TLAssetStore = {
	async upload(asset, file) {
		const url = await uploadToYourServer(file)
		return { src: url }
	},
	resolve(asset) {
		return asset.props.src
	},
}

export default function App() {
	const store = useSync({
		uri: 'wss://your-server.com/sync/room-id',
		assets: assetStore,
		userInfo: { id: 'user-1', name: 'Alice', color: '#ff0000' },
	})

	if (store.status === 'loading') return <div>Loading...</div>
	if (store.status === 'error') return <div>Error: {store.error.message}</div>

	return <Tldraw store={store.store} />
}
```

### Cloudflare Workers backend

See the `sync-cloudflare` template for a production-ready backend using:

- Cloudflare Workers for the API
- Durable Objects for room state
- R2 for asset storage

## External content handling

Register handlers for URLs, files, and other external content:

```tsx
<Tldraw
	onMount={(editor) => {
		editor.registerExternalAssetHandler('url', async ({ url }) => {
			// Fetch metadata and create a bookmark shape
			const metadata = await fetchUrlMetadata(url)
			return {
				id: createShapeId(),
				type: 'bookmark',
				props: {
					url,
					title: metadata.title,
					description: metadata.description,
					image: metadata.image,
				},
			}
		})
	}}
/>
```

## Common patterns

### Get editor outside React

```tsx
let editorRef: Editor | null = null

<Tldraw onMount={(e) => { editorRef = e }} />

// Later...
editorRef?.createShape({ type: 'geo', x: 0, y: 0 })
```

### Read-only mode

```tsx
<Tldraw
	onMount={(editor) => {
		editor.updateInstanceState({ isReadonly: true })
	}}
/>
```

### Dark mode

```tsx
<Tldraw
	onMount={(editor) => {
		editor.user.updateUserPreferences({ colorScheme: 'dark' })
	}}
/>
```

### Focus mode (hide UI chrome)

```tsx
<Tldraw
	onMount={(editor) => {
		editor.updateInstanceState({ isFocusMode: true })
	}}
/>
```

### Export to image

```tsx
import { exportToBlob } from 'tldraw'

const blob = await exportToBlob({
	editor,
	ids: editor.getSelectedShapeIds(),
	format: 'png',
})
```

## Best practices

1. **Import CSS**: Always import `tldraw/tldraw.css` (or `@tldraw/editor/editor.css` for editor-only)

2. **Define static config outside components**: Shape utils, tools, and component overrides should be defined outside React components or memoized to prevent re-creation on every render

3. **Use batch for multiple operations**: Wrap multiple editor operations in `editor.batch()` for performance

4. **Never mutate shapes directly**: Always use `editor.updateShape()` or return new objects from shape methods

5. **Clean up effects**: If using `react()` or `computed()` from `@tldraw/state`, store the cleanup function and call it when done

6. **Handle loading states**: When using `useSync`, always handle `loading` and `error` states

7. **Add migrations for schema changes**: If changing custom shape props, add migrations to handle old data

## Common pitfalls

1. **Missing CSS import**: Forgetting to import `tldraw/tldraw.css` causes invisible or broken UI

2. **SSR issues**: tldraw requires browser APIs - use `'use client'` in Next.js or dynamic imports

3. **Recreating config on render**: Defining `shapeUtils`, `tools`, or `components` inline causes performance issues

4. **Mutating state directly**: Directly modifying shape objects breaks reactivity - always use editor methods

5. **Memory leaks**: Forgetting to clean up `react()` subscriptions or event listeners

6. **Using bare `tsc`**: In this monorepo, always use `npm run typecheck` instead of bare `tsc`

## Package structure

| Package             | Purpose                                 |
| ------------------- | --------------------------------------- |
| `tldraw`            | Complete SDK with shapes, tools, and UI |
| `@tldraw/editor`    | Core engine without shapes or UI        |
| `@tldraw/state`     | Reactive signals library                |
| `@tldraw/store`     | Reactive document database              |
| `@tldraw/tlschema`  | Type definitions and validators         |
| `@tldraw/sync`      | Multiplayer React hooks                 |
| `@tldraw/sync-core` | Core sync infrastructure                |
| `@tldraw/validate`  | Schema validation                       |
| `@tldraw/utils`     | Shared utilities                        |

## Resources

- **Docs**: https://tldraw.dev
- **API Reference**: https://tldraw.dev/reference
- **Examples**: https://examples.tldraw.com and https://tldraw.dev/examples
- **Discord**: https://discord.tldraw.com
- **GitHub**: https://github.com/tldraw/tldraw

## Example categories

When looking for examples, they're organized into these categories:

- `getting-started` - Basic usage patterns
- `configuration` - Editor setup and options
- `editor-api` - Core editor API usage
- `ui` - User interface customization
- `layout` - Canvas and viewport control
- `events` - Event handling and interactivity
- `shapes/tools` - Custom shapes and tools
- `collaboration` - Multi-user features
- `data/assets` - Data management and asset handling
- `use-cases` - Complete application scenarios

## Templates

Official starter templates are available:

- `vite` - Vite + React
- `nextjs` - Next.js App Router
- `sync-cloudflare` - Production multiplayer backend with Cloudflare

Create a new project: `npx create-tldraw@latest`
