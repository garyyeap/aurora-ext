###
   AAC.js - Advanced Audio Coding decoder in JavaScript
   Created by Devon Govett
   Copyright (c) 2012, Official.fm Labs

   AAC.js is free software; you can redistribute it and/or modify it
   under the terms of the GNU Lesser General Public License as
   published by the Free Software Foundation; either version 3 of the
   License, or (at your option) any later version.

   AAC.js is distributed in the hope that it will be useful, but WITHOUT
   ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
   or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU Lesser General
   Public License for more details.

   You should have received a copy of the GNU Lesser General Public
   License along with this library.
   If not, see <http://www.gnu.org/licenses/>.
###

ADTSDemuxer = require '../../demuxers/adts'
Decoder     = require '../../decoder'
Bitstream   = require '../../core/bitstream'
Stream      = require '../../core/stream'
ICStream    = require './ics'
CPEElement  = require './cpe'
CCEElement  = require './cce'
FilterBank  = require './filter_bank'
tables      = require './tables'

class AACDecoder extends Decoder
    Decoder.register('mp4a', AACDecoder)
    Decoder.register('aac ', AACDecoder)

    # AAC profiles
    AOT_AAC_MAIN = 1 # no
    AOT_AAC_LC   = 2   # yes
    AOT_AAC_LTP  = 4  # no
    AOT_ESCAPE   = 31

    # Channel configurations
    CHANNEL_CONFIG_NONE                              = 0
    CHANNEL_CONFIG_MONO                              = 1
    CHANNEL_CONFIG_STEREO                            = 2
    CHANNEL_CONFIG_STEREO_PLUS_CENTER                = 3
    CHANNEL_CONFIG_STEREO_PLUS_CENTER_PLUS_REAR_MONO = 4
    CHANNEL_CONFIG_FIVE                              = 5
    CHANNEL_CONFIG_FIVE_PLUS_ONE                     = 6
    CHANNEL_CONFIG_SEVEN_PLUS_ONE                    = 8

    init: ->
      @format.floatingPoint = true

    setCookie: (buffer) ->
        CHANNEL_CONFIG_FIVE_PLUS_ONE
        data = Stream.fromBuffer(buffer)
        stream = new Bitstream(data)

        @config = {}

        @config.profile = stream.read(5)
        if @config.profile is AOT_ESCAPE
            @config.profile = 32 + stream.read(6)

        @config.sampleIndex = stream.read(4)
        if @config.sampleIndex is 0x0f
            @config.sampleRate = stream.read(24)
            for i in [0...tables.SAMPLE_RATES.length]
                if tables.SAMPLE_RATES[i] is @config.sampleRate
                    @config.sampleIndex = i
                    break
        else
            @config.sampleRate = tables.SAMPLE_RATES[@config.sampleIndex]

        @config.chanConfig = stream.read(4)
        @format.channelsPerFrame = @config.chanConfig # sometimes m4a files encode this wrong

        switch @config.profile
            when AOT_AAC_LTP, AOT_AAC_MAIN, AOT_AAC_LC
                if stream.read(1) # frameLengthFlag
                    throw new Error('frameLengthFlag not supported')

                @config.frameLength = 1024

                if stream.read(1) # dependsOnCoreCoder
                    stream.advance(14) # coreCoderDelay

                if stream.read(1) # extensionFlag
                    if @config.profile > 16 # error resiliant profile
                        @config.sectionDataResilience = stream.read(1)
                        @config.scalefactorResilience = stream.read(1)
                        @config.spectralDataResilience = stream.read(1)

                    stream.advance(1)

                if @config.chanConfig is CHANNEL_CONFIG_NONE
                    stream.advance(4) # element_instance_tag
                    throw new Error('PCE unimplemented')
            else
                throw new Error("AAC profile#{@config.profile}not supported.")

        @filter_bank = new FilterBank(false, @config.chanConfig)
        @ics = new ICStream(@config)
        @cpe = new CPEElement(@config)
        @cce = new CCEElement(@config)

    SCE_ELEMENT = 0
    CPE_ELEMENT = 1
    CCE_ELEMENT = 2
    LFE_ELEMENT = 3
    DSE_ELEMENT = 4
    PCE_ELEMENT = 5
    FIL_ELEMENT = 6
    END_ELEMENT = 7

    # The main decoding function.
    readChunk: ->
        stream = @bitstream

        # check if there is an ADTS header, and read it if so
        ADTSDemuxer.readHeader(stream) if stream.peek(12) is 0xfff

        @cces = []
        elements = []
        config = @config
        frameLength = config.frameLength
        elementType = null

        while (elementType = stream.read(3)) isnt END_ELEMENT
            id = stream.read(4)
            console.log(elementType)

            switch elementType
                # single channel and low frequency elements
                when SCE_ELEMENT, LFE_ELEMENT
                    ics = @ics
                    ics.id = id
                    elements.push(ics)
                    ics.decode(stream, config, false)

                # channel pair element
                when CPE_ELEMENT
                    cpe = @cpe
                    cpe.id = id
                    elements.push(cpe)
                    cpe.decode(stream, config)

                # channel coupling element
                when CCE_ELEMENT
                    cce = @cce
                    @cces.push(cce)
                    cce.decode(stream, config)

                # data-stream element
                when DSE_ELEMENT
                    align = stream.read(1)
                    count = stream.read(8)

                    count += stream.read(8) if count is 255

                    stream.align() if align

                    # skip for now...
                    stream.advance(count * 8)

                # program configuration element
                when PCE_ELEMENT
                    throw new Error("TODO: PCE_ELEMENT")

                # filler element
                when FIL_ELEMENT
                    if id is 15
                        id += stream.read(8) - 1

                    # skip for now...
                    stream.advance(id * 8)

                else
                    throw new Error('Unknown element')

        stream.align()
        @process(elements)

        # Interleave channels
        data = @data
        channels = data.length
        output = new Float32Array(frameLength * channels)
        j = 0

        for k in [0...frameLength]
            for i in [0...channels]
                output[j++] = data[i][k] / 32768

        output

    process: (elements) ->
        channels = @config.chanConfig

        # if channels is 1 and psPresent
        # TODO: sbrPresent (2)
        mult = 1

        len = mult * @config.frameLength
        data = @data = []

        # Initialize channels
        for i in [0...channels]
            data[i] = new Float32Array(len)

        channel = 0
        for i in [0...elements.length]
            break if channel >= channels
            e = elements[i]

            if e instanceof ICStream # SCE or LFE element
                channel += @processSingle(e, channel)
            else if e instanceof CPEElement
                @processPair(e, channel)
                channel += 2
            else if e instanceof CCEElement
                channel++
            else
                throw new Error("Unknown element found.")

    processSingle: (element, channel) ->
        profile = @config.profile
        info = element.info
        data = element.data

        if profile is AOT_AAC_MAIN
            throw new Error("Main prediction unimplemented")

        if profile is AOT_AAC_LTP
            throw new Error("LTP prediction unimplemented")

        @applyChannelCoupling(element, CCEElement.BEFORE_TNS, data, null)

        if element.tnsPresent
            element.tns.process(element, data, false)

        @applyChannelCoupling(element, CCEElement.AFTER_TNS, data, null)

        # filterbank
        @filter_bank.process(info, data, @data[channel], channel)

        if profile is AOT_AAC_LTP
            throw new Error("LTP prediction unimplemented")

        @applyChannelCoupling(element, CCEElement.AFTER_IMDCT, @data[channel], null)

        if element.gainPresent
            throw new Error("Gain control not implemented")

        if @sbrPresent
            throw new Error("SBR not implemented")

        1

    processPair: (element, channel) ->
        profile = @config.profile
        left = element.left
        right = element.right
        l_info = left.info
        r_info = right.info
        l_data = left.data
        r_data = right.data

        # Mid-side stereo
        if (element.commonWindow && element.maskPresent)
            @processMS(element, l_data, r_data)

        if profile is AOT_AAC_MAIN
            throw new Error("Main prediction unimplemented")

        # Intensity stereo
        @processIS(element, l_data, r_data)

        if profile is AOT_AAC_LTP
            throw new Error("LTP prediction unimplemented")

        @applyChannelCoupling(element, CCEElement.BEFORE_TNS, l_data, r_data)

        left.tns.process(left, l_data, false) if left.tnsPresent

        right.tns.process(right, r_data, false) if right.tnsPresent

        @applyChannelCoupling(element, CCEElement.AFTER_TNS, l_data, r_data)

        # filterbank
        @filter_bank.process(l_info, l_data, @data[channel], channel)
        @filter_bank.process(r_info, r_data, @data[channel + 1], channel + 1)

        if profile is AOT_AAC_LTP
            throw new Error("LTP prediction unimplemented")

        @applyChannelCoupling(element, CCEElement.AFTER_IMDCT, @data[channel], @data[channel + 1])

        if left.gainPresent
            throw new Error("Gain control not implemented")

        if right.gainPresent
            throw new Error("Gain control not implemented")

        if @sbrPresent
            throw new Error("SBR not implemented")

    # Intensity stereo
    processIS: (element, left, right) ->
        ics = element.right
        info = ics.info
        offsets = info.swbOffsets
        windowGroups = info.groupCount
        maxSFB = info.maxSFB
        bandTypes = ics.bandTypes
        sectEnd = ics.sectEnd
        scaleFactors = ics.scaleFactors

        idx = 0
        groupOff = 0
        for g in [0...windowGroups]
            i = 0
            while i < maxSFB
                end = sectEnd[idx]

                if bandTypes[idx] is ICStream.INTENSITY_BT or bandTypes[idx] is ICStream.INTENSITY_BT2
                    while i < end
                        c = if bandTypes[idx] is ICStream.INTENSITY_BT then 1 else -1
                        if element.maskPresent
                            c *= if element.ms_used[idx] then -1 else 1

                        scale = c * scaleFactors[idx]
                        for w in [0...info.groupLength[g]]
                            offset = groupOff + w * 128 + offsets[i]
                            len = offsets[i + 1] - offsets[i]

                            for j in [j...len]
                                right[offset + j] = left[offset + j] * scale
                        i++
                        idx++
                else
                    idx += end - i
                    i = end

            groupOff += info.groupLength[g] * 128

    processMS: (element, left, right) ->
        ics = element.left
        info = ics.info
        offsets = info.swbOffsets
        windowGroups = info.groupCount
        maxSFB = info.maxSFB
        sfbCBl = ics.bandTypes
        sfbCBr = element.right.bandTypes

        groupOff = 0
        idx = 0
        for g in [0...windowGroups]
            for i in [0...maxSFB]
                if element.ms_used[idx] and sfbCBl[idx] < ICStream.NOISE_BT and sfbCBr[idx] < ICStream.NOISE_BT
                    for w in [0...info.groupLength[g]]
                        offset = groupOff + w * 128 + offsets[i]
                        for j in [0...offsets[i + 1] - offsets[i]]
                            t = left[offset + j] - right[offset + j]
                            left[offset + j] += right[offset + j]
                            right[offset + j] = t
                idx++
            groupOff += info.groupLength[g] * 128

    applyChannelCoupling: (element, couplingPoint, data1, data2) ->
        cces = @cces
        isChannelPair = element instanceof CPEElement
        applyCoupling = couplingPoint is CCEElement.AFTER_IMDCT ? 'applyIndependentCoupling' : 'applyDependentCoupling'

        for i in [0...cces.length]
            cce = cces[i]
            index = 0

            if cce.couplingPoint is couplingPoint
                for c in [0...cce.coupledCount]
                    chSelect = cce.chSelect[c]
                    if cce.channelPair[c] is isChannelPair and cce.idSelect[c] is element.id
                        unless chSelect is 1
                            cce[applyCoupling](index, data1)
                            index++ if chSelect

                        cce[applyCoupling](index++, data2) unless chSelect is 2

                    else
                        index += 1 + (chSelect is 3 ? 1 : 0)

module.exports = AACDecoder