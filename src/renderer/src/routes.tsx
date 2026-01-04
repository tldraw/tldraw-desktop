import { createRoutesFromElements, Navigate, Outlet, Route, useRouteError } from 'react-router'
import { ErrorDisplay } from './components/ErrorDisplay'
import { useSearchParamSettings } from './hooks/useSearchParams'

function ErrorBoundaryComponent() {
	const error = useRouteError()
	console.error(error)

	const errorMessage = error instanceof Error ? error.message : String(error)
	const errorStack = error instanceof Error ? error.stack : undefined

	return <ErrorDisplay error={errorMessage} stack={errorStack} />
}

const ROUTES = {
	root: '/',
	error: '/error',
	file: '/f/:id',
	home: '/home',
	about: '/about',
	license: '/license',
}

export const router = createRoutesFromElements(
	<Route ErrorBoundary={ErrorBoundaryComponent}>
		<Route element={<ParamsContainer />}>
			<Route path={ROUTES.root} lazy={() => import('./pages/empty')} />
			<Route path={ROUTES.about} lazy={() => import('./pages/about')} />
			<Route path={ROUTES.license} lazy={() => import('./pages/license')} />
			<Route path={ROUTES.error} lazy={() => import('./pages/error')} />
			<Route path={ROUTES.file} lazy={() => import('./pages/editor')} />
			<Route path={ROUTES.home} lazy={() => import('./pages/home')} />
			{/* For all other routes, navigate back to root */}
			<Route path="*" element={<Navigate to="/" replace />} />
		</Route>
	</Route>
)

function ParamsContainer() {
	useSearchParamSettings()
	return <Outlet />
}
