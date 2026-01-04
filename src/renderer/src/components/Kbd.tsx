import { tlenv, TLUiKbdProps } from 'tldraw'

export function Kbd({ children }: TLUiKbdProps) {
	return (
		<kbd className="tlui-kbd">
			{kbd(children).map((k, i) => (
				<span key={i}>{k}</span>
			))}
		</kbd>
	)
}

const cmdKey = tlenv.isDarwin ? '⌘' : 'Ctrl'
const altKey = tlenv.isDarwin ? '⌥' : 'Alt'

/** @public */
export function kbd(str: string) {
	if (str === ',') return [',']

	return str
		.split(',')[0]
		.split('')
		.map((sub) => {
			const subStr = sub.replace(/\$/g, cmdKey).replace(/\?/g, altKey).replace(/!/g, '⇧')
			return subStr[0].toUpperCase() + subStr.slice(1)
		})
}

/** @public */
export function kbdStr(str: string) {
	return '— ' + kbd(str).join(' ')
}
