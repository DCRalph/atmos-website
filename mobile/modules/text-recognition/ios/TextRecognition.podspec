Pod::Spec.new do |s|
  s.name           = 'TextRecognition'
  s.version        = '1.0.0'
  s.summary        = 'On-device text and face recognition for door ID checks.'
  s.description    = "Wraps Apple's Vision framework so an ID document can be " \
                     'read on the handset. Nothing is uploaded to read it: the ' \
                     'photo is recognised locally and only the resulting text ' \
                     'and a cropped portrait ever leave the phone.'
  s.author         = 'Atmos Media'
  s.homepage       = 'https://atmosmedia.co.nz'
  s.license        = { :type => 'Proprietary' }
  # Vision is a system framework and needs no entry here — Swift auto-links it
  # from the `import`, the same way ProximityReader is picked up next door.
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
