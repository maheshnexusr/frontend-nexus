/**
 * App — root component.
 * Wires Redux store, the router, and the global toast container.
 * ToastContainer sits outside RouterProvider so it survives route transitions.
 */

import { Provider }        from 'react-redux';
import { RouterProvider }  from 'react-router-dom';
import store               from '@/app/store';
import { router }          from '@/app/router';
import ToastContainer      from '@/components/feedback/ToastContainer';

export default function App() {
  return (
    <Provider store={store}>
      <RouterProvider router={router} />
      <ToastContainer />
    </Provider>
  );
}
