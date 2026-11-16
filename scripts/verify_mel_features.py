"""Work out exactly what Essentia's model input stage does, so it can be re-implemented on Android.

Compares Essentia's TensorflowInputMusiCNN with a plain-NumPy version under each plausible
setting, saves the mel filterbank Essentia uses, then runs the model on the NumPy features.
"""
import sys, json
import numpy as np
import essentia.standard as es
import onnxruntime as ort

wav, model_path, meta_path, out_dir = sys.argv[1:5]
raw = open(wav, 'rb').read()
at = raw.find(b'data') + 8
audio = np.frombuffer(raw[at:len(raw) - (len(raw) - at) % 4], dtype='<f4').copy()
start = int(len(audio) * 0.45)
audio = audio[start:start + 16000 * 30]

N, HOP, BANDS = 512, 256, 96
ref_alg = es.TensorflowInputMusiCNN()
frames = [audio[i:i + N] for i in range(0, len(audio) - N + 1, HOP)]
ref = np.array([ref_alg(f) for f in frames])
print('reference mel shape', ref.shape, 'range', ref.min(), ref.max())

# The filterbank is linear, so feeding one-hot spectra through MelBands reads it out exactly.
def filterbank(kind):
    mb = es.MelBands(numberBands=BANDS, sampleRate=16000, lowFrequencyBound=0,
                     highFrequencyBound=8000, inputSize=N // 2 + 1, weighting='linear',
                     normalize='unit_tri', warpingFormula='slaneyMel', type=kind)
    eye = np.eye(N // 2 + 1, dtype=np.float32)
    return np.array([mb(eye[k]) for k in range(N // 2 + 1)]).T  # [bands, bins]

hann = (0.5 - 0.5 * np.cos(2 * np.pi * np.arange(N) / (N - 1))).astype(np.float32)
best = None
for kind in ('power', 'magnitude'):
    M = filterbank(kind)
    for win_name, win in (('plain', hann), ('normalized', hann / hann.sum() * 2)):
        for spec_pow in (1, 2):
            spec = np.abs(np.fft.rfft(np.array(frames) * win, axis=1)).astype(np.float32) ** spec_pow
            mine = np.log10(1 + 10000 * (spec @ M.T))
            err = float(np.abs(mine - ref).max())
            print(f'  filterbank={kind:9s} window={win_name:10s} spectrum^{spec_pow}: max abs error {err:.5f}')
            if best is None or err < best[0]:
                best = (err, kind, win_name, spec_pow, M, mine)

err, kind, win_name, spec_pow, M, mine = best
print('BEST:', kind, win_name, f'spectrum^{spec_pow}', 'max abs error', err)
M.astype('<f4').tofile(f'{out_dir}/mel_filterbank_96x257.f32')
print('filterbank saved', M.shape, 'nonzero per band (first 5):', [(int((r > 0).sum())) for r in M[:5]])

classes = json.load(open(meta_path))['classes']
sess = ort.InferenceSession(model_path)
inp = sess.get_inputs()[0]
print('model input', inp.name, inp.shape, '| outputs', [(o.name, o.shape) for o in sess.get_outputs()])

def predict(mel):
    patches = np.array([mel[i:i + 128] for i in range(0, len(mel) - 128 + 1, 64)], dtype=np.float32)
    outs = sess.run(None, {inp.name: patches})
    probs = next(o for o in outs if o.shape[1] == 400)
    return probs.mean(axis=0), len(patches)

for name, mel in (('essentia features', ref), ('numpy features', mine)):
    p, n = predict(mel)
    top = np.argsort(-p)[:6]
    print(f'{name} ({n} patches):', ', '.join(f'{classes[i]} {p[i]:.2f}' for i in top))
json.dump(classes, open(f'{out_dir}/discogs_classes.json', 'w'))
