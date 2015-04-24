tables = require '../decoders/aac/tables'
Demuxer = require '../demuxer'
Bitstream = require '../core/bitstream'
Buffer = require '../core/buffer'

class ADTSDemuxer extends Demuxer
    Demuxer.register(ADTSDemuxer)

    @probe: (stream) ->
        offset = stream.offset

        # attempt to find ADTS syncword
        while stream.available(2)
            if (stream.readUInt16() & 0xfff6) is 0xfff0
                stream.seek(offset)
                return true

        stream.seek(offset)
        return false

    init: ->
        @bitstream = new Bitstream(@stream)

    # Reads an ADTS header
    # See http://wiki.multimedia.cx/index.php?title=ADTS
    @readHeader: (stream) ->
        throw new Error('Invalid ADTS header.') unless stream.read(12) is 0xfff

        ret = {}
        stream.advance(3); # mpeg version and layer
        protectionAbsent = !!stream.read(1)

        ret.profile = stream.read(2) + 1
        ret.samplingIndex = stream.read(4)

        stream.advance(1); # private
        ret.chanConfig = stream.read(3)
        stream.advance(4) # original/copy, home, copywrite, and copywrite start

        ret.frameLength = stream.read(13)
        stream.advance(11) # fullness

        ret.numFrames = stream.read(2) + 1

        stream.advance(16) if (!protectionAbsent)
        return ret

    readChunk: ->
        unless @sentHeader
            offset = @stream.offset;
            header = ADTSDemuxer.readHeader(@bitstream)
            format =
                formatID: 'aac '
                sampleRate: tables.SAMPLE_RATES[header.samplingIndex]
                channelsPerFrame: header.chanConfig
                bitsPerChannel: 16

            @emit('format', format)

            # generate a magic cookie from the ADTS header
            cookie = new Uint8Array(2)
            cookie[0] = (header.profile << 3) | ((header.samplingIndex >> 1) & 7)
            cookie[1] = ((header.samplingIndex & 1) << 7) | (header.chanConfig << 3)
            @emit('cookie', new Buffer(cookie))

            @stream.seek(offset)
            @sentHeader = true

        while @stream.available(1)
            buffer = @stream.readSingleBuffer(@stream.remainingBytes())
            @emit('data', buffer)