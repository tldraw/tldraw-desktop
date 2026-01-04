import classNames from 'classnames'
import { HTMLProps } from 'react'
import { WindowControls } from './WindowControls'

export function TitleBar({ children, className, ...rest }: HTMLProps<HTMLDivElement>) {
	return (
		<div className={classNames('editor__titlebar', className)} {...rest}>
			<WindowControls />
			{children}
		</div>
	)
}
