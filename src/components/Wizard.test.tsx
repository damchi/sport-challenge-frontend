import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { useForm } from 'react-hook-form';
import { renderWithProviders } from '../test/render';
import { Wizard } from './Wizard';

// Three steps over one form, as a caller builds them; a step is valid once
// its field is filled in.
function ThreeSteps({ validate }: { validate?: (index: number) => Promise<boolean> }) {
  const { register, getValues } = useForm({ defaultValues: { a: '', b: '', c: '' } });
  const names = ['a', 'b', 'c'] as const;
  return (
    <Wizard
      steps={names.map((name) => ({
        title: `Step ${name}`,
        content: <input aria-label={`Field ${name}`} {...register(name)} />,
      }))}
      validateStep={validate ?? ((index) => Promise.resolve(getValues(names[index] ?? 'a') !== ''))}
    />
  );
}

const next = () => fireEvent.click(screen.getByRole('button', { name: 'Suivant' }));

describe('Wizard', () => {
  it('shows the progress and the first step, without a way back', () => {
    renderWithProviders(<ThreeSteps />);

    expect(screen.getByText('Étape 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Step a' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Retour' })).not.toBeInTheDocument();
  });

  it('moves on only once the step is valid, then focuses the new step', async () => {
    let answer: (valid: boolean) => void = () => undefined;
    const validate = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          answer = resolve;
        }),
    );
    renderWithProviders(<ThreeSteps validate={validate} />);

    next();
    await waitFor(() => expect(validate).toHaveBeenCalledWith(0));
    await act(async () => answer(false));
    expect(screen.getByText('Étape 1 sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Step a' })).toBeInTheDocument();

    next();
    await waitFor(() => expect(validate).toHaveBeenCalledTimes(2));
    await act(async () => answer(true));

    const heading = await screen.findByRole('heading', { name: 'Step b' });
    expect(screen.getByText('Étape 2 sur 3')).toBeInTheDocument();
    expect(heading).toHaveFocus();
  });

  it('goes back without losing what was entered', async () => {
    renderWithProviders(<ThreeSteps />);

    fireEvent.change(screen.getByLabelText('Field a'), { target: { value: 'first' } });
    next();
    fireEvent.change(await screen.findByLabelText('Field b'), { target: { value: 'second' } });
    fireEvent.click(screen.getByRole('button', { name: 'Retour' }));

    expect(await screen.findByLabelText('Field a')).toHaveValue('first');
    expect(screen.getByRole('heading', { name: 'Step a' })).toHaveFocus();
    next();
    expect(await screen.findByLabelText('Field b')).toHaveValue('second');
  });

  it('validates the step it is on, and has no Next on the last one', async () => {
    const validate = vi.fn<(index: number) => Promise<boolean>>(() => Promise.resolve(true));
    renderWithProviders(<ThreeSteps validate={validate} />);

    next();
    await screen.findByRole('heading', { name: 'Step b' });
    next();
    await screen.findByRole('heading', { name: 'Step c' });

    expect(validate.mock.calls.map(([index]) => index)).toEqual([0, 1]);
    expect(screen.getByText('Étape 3 sur 3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Suivant' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retour' })).toBeInTheDocument();
  });

  it('moves on with Enter in a field', async () => {
    renderWithProviders(<ThreeSteps />);

    const field = screen.getByLabelText('Field a');
    fireEvent.change(field, { target: { value: 'x' } });
    fireEvent.submit(field);

    expect(await screen.findByRole('heading', { name: 'Step b' })).toBeInTheDocument();
  });
});
