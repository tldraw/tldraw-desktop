import { LoaderFunctionArgs, useLoaderData } from 'react-router-dom'

export function defineLoader<T>(_loader: (args: LoaderFunctionArgs) => Promise<T>): {
	loader(args: LoaderFunctionArgs): Promise<{ [specialSymbol]: T }>
	useData(): Exclude<T, Response>
} {
	const specialSymbol = Symbol('loader')
	const loader = async (params: LoaderFunctionArgs): Promise<{ [specialSymbol]: T }> => {
		const result = await _loader(params)
		if (result instanceof Response) {
			throw result
		}
		return {
			[specialSymbol]: result,
		}
	}

	return {
		loader,
		useData() {
			const raw = useLoaderData()
			if (typeof raw === 'object' && raw && specialSymbol in raw) return raw[specialSymbol]
			throw new Error('Loader data not found')
		},
	}
}
